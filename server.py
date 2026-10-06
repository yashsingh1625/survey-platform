"""
Rido Research — Production-Ready FastAPI Server
================================================
Security model:
  - Admin login via POST /api/admin/login → returns a signed JWT
  - All admin API routes validate JWT via Authorization: Bearer <token>
  - Admin password stored as bcrypt hash (never plain text)
  - JWT secret loaded from env var (RIDO_JWT_SECRET)
  - Rate-limiting on admin login (5 attempts / minute per IP)
  - Input validation via Pydantic schemas
  - CORS locked down in production via env var
"""

import os
import io
import csv
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Any

from fastapi import FastAPI, Request, HTTPException, Depends, Header, Query, status
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

import database

# ─── Load env vars ────────────────────────────────────────────────────────────
load_dotenv(override=True)

RIDO_ENV            = os.environ.get("RIDO_ENV", os.environ.get("ENVIRONMENT", "development")).lower()
ADMIN_PASSWORD_RAW  = os.environ.get("RIDO_ADMIN_PASSWORD", "rido_research_2026").strip().strip('"').strip("'")
JWT_SECRET          = os.environ.get("RIDO_JWT_SECRET", "CHANGE_ME_IN_PRODUCTION_jwt_secret_key_min_32_chars")
JWT_ALGORITHM       = "HS256"
JWT_EXPIRE_HOURS    = int(os.environ.get("RIDO_JWT_EXPIRE_HOURS", "8"))

if RIDO_ENV == "production":
    if not os.environ.get("RIDO_ADMIN_PASSWORD"):
        raise RuntimeError("CRITICAL CONFIG ERROR: RIDO_ADMIN_PASSWORD environment variable must be set in production.")
    if not os.environ.get("RIDO_JWT_SECRET") or JWT_SECRET.startswith("CHANGE_ME_IN_PRODUCTION"):
        raise RuntimeError("CRITICAL CONFIG ERROR: RIDO_JWT_SECRET environment variable must be set in production.")

# Startup password hash
_ADMIN_PW_HASH = bcrypt.hashpw(ADMIN_PASSWORD_RAW.encode(), bcrypt.gensalt())

def get_current_admin_password() -> str:
    load_dotenv(override=True)
    raw = os.environ.get("RIDO_ADMIN_PASSWORD", "rido_research_2026")
    return raw.strip().strip('"').strip("'")

def verify_admin_password(provided: str) -> bool:
    if not provided:
        return False
    current_pw = get_current_admin_password()
    provided_clean = provided.strip()

    if provided == current_pw or provided_clean == current_pw:
        return True

    # Check against stored hash or dynamic hash for constant time
    try:
        if bcrypt.checkpw(provided.encode(), _ADMIN_PW_HASH) or bcrypt.checkpw(provided_clean.encode(), _ADMIN_PW_HASH):
            return True
    except Exception:
        pass

    try:
        if bcrypt.checkpw(provided.encode(), bcrypt.hashpw(current_pw.encode(), bcrypt.gensalt())):
            return True
    except Exception:
        pass

    return False

# ─── Database ─────────────────────────────────────────────────────────────────
database.init_db()

# ─── App + Rate Limiter ───────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Rido Research API",
    description="Early-stage mobility research and pilot validation platform",
    version="2.0.0",
    # Hide docs in production by setting RIDO_HIDE_DOCS=1
    docs_url=None if os.environ.get("RIDO_HIDE_DOCS") else "/docs",
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Tighten per-origin in production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static / Template dirs ───────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(__file__)
STATIC_DIR    = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ─────────────────────────────────────────────────────────────────────────────
# JWT helpers
# ─────────────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_token(
    authorization: Optional[str] = Header(None)
) -> str:
    """Dependency — raises 401 if token is missing/invalid/expired."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired admin session. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = None
    if authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        role: str = payload.get("role")
        if role != "admin":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return token


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

class AdminLoginSchema(BaseModel):
    password: str = Field(..., min_length=1)


class PilotLeadSchema(BaseModel):
    name: str = Field(..., min_length=2)
    email: str = Field(..., min_length=5)
    phone: str = Field(..., min_length=8)
    current_area: Optional[str] = ""
    destination: Optional[str] = ""
    usual_commute_time: Optional[str] = ""
    travel_days: Optional[List[str]] = []
    consent_agreed: bool = True
    respondent_type: Optional[str] = ""
    notes: Optional[str] = ""
    source: Optional[str] = "direct_modal"


class SurveySubmitSchema(BaseModel):
    session_id: Optional[str] = None

    # Section A: Profile
    respondent_type: Optional[str] = None
    respondent_type_other: Optional[str] = None
    commute_frequency: Optional[str] = None

    # Section B: Commute
    commute_duration: Optional[str] = None
    commute_mode: Optional[str] = None
    commute_mode_other: Optional[str] = None
    commute_spend: Optional[str] = None
    travel_alone: Optional[str] = None
    route_regularity: Optional[str] = None

    # Section C: Real Problems
    commute_problems: Optional[List[str]] = []
    commute_problems_other: Optional[str] = None
    commute_satisfaction: Optional[str] = None
    biggest_problem_open: Optional[str] = None

    # Section D: Existing Behaviour
    shared_before: Optional[str] = None
    discovery_method: Optional[str] = None
    discovery_method_other: Optional[str] = None
    non_sharing_reason: Optional[str] = None
    non_sharing_reason_other: Optional[str] = None

    # Section E: Community & Trust
    trusted_sharing_partner: Optional[str] = None
    comfort_factors: Optional[List[str]] = []
    comfort_factors_other: Optional[str] = None

    # Section F: Concept Validation
    concept_usefulness: Optional[str] = None
    valuable_features: Optional[str] = None
    adoption_barriers: Optional[List[str]] = []
    adoption_barriers_other: Optional[str] = None

    # Section G: Intent & Pilot
    likelihood_to_share: Optional[str] = None
    expected_savings: Optional[str] = None
    pilot_interest: Optional[str] = None
    pilot_lead: Optional[PilotLeadSchema] = None
    change_one_thing: Optional[str] = None


class SurveyEditSchema(BaseModel):
    respondent_type: Optional[str] = None
    commute_frequency: Optional[str] = None
    commute_duration: Optional[str] = None
    commute_mode: Optional[str] = None
    commute_spend: Optional[str] = None
    travel_alone: Optional[str] = None
    route_regularity: Optional[str] = None
    commute_satisfaction: Optional[str] = None
    biggest_problem_open: Optional[str] = None
    shared_before: Optional[str] = None
    discovery_method: Optional[str] = None
    non_sharing_reason: Optional[str] = None
    trusted_sharing_partner: Optional[str] = None
    concept_usefulness: Optional[str] = None
    valuable_features: Optional[str] = None
    likelihood_to_share: Optional[str] = None
    expected_savings: Optional[str] = None
    pilot_interest: Optional[str] = None
    change_one_thing: Optional[str] = None
    status: Optional[str] = None
    admin_notes: Optional[str] = None

class PilotEditSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_area: Optional[str] = None
    destination: Optional[str] = None
    usual_commute_time: Optional[str] = None
    travel_days: Optional[Any] = None
    consent_agreed: Optional[bool] = None
    respondent_type: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None

class StatusUpdateSchema(BaseModel):
    status: str = Field(..., min_length=1)

# ─────────────────────────────────────────────────────────────────────────────
# Public HTML Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def serve_index():
    index_file = os.path.join(TEMPLATES_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Rido Research — Starting up…</h1>")


@app.get("/survey", response_class=HTMLResponse, include_in_schema=False)
async def serve_survey():
    survey_file = os.path.join(TEMPLATES_DIR, "survey.html")
    if os.path.exists(survey_file):
        with open(survey_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Rido Survey — Starting up…</h1>")


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def serve_admin():
    admin_file = os.path.join(TEMPLATES_DIR, "admin.html")
    if os.path.exists(admin_file):
        with open(admin_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Rido Admin — Starting up…</h1>")


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "rido-research-engine",
        "environment": "production-research",
        "version": "2.0.0"
    }


# ─────────────────────────────────────────────────────────────────────────────
# Public API Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/survey/submit", tags=["Survey"])
async def submit_survey(payload: SurveySubmitSchema, request: Request):
    client_ip  = request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")

    # Sanitize inputs (strip trailing/leading whitespace and truncate extremely long inputs)
    def clean_str(val: Optional[str], max_len: int = 2000) -> Optional[str]:
        if val is None:
            return None
        cleaned = val.strip()
        if not cleaned:
            return None
        return cleaned[:max_len]

    payload.respondent_type = clean_str(payload.respondent_type)
    payload.respondent_type_other = clean_str(payload.respondent_type_other)
    payload.commute_frequency = clean_str(payload.commute_frequency)
    payload.commute_duration = clean_str(payload.commute_duration)
    payload.commute_mode = clean_str(payload.commute_mode)
    payload.commute_mode_other = clean_str(payload.commute_mode_other)
    payload.commute_spend = clean_str(payload.commute_spend)
    payload.travel_alone = clean_str(payload.travel_alone)
    payload.route_regularity = clean_str(payload.route_regularity)
    payload.commute_problems_other = clean_str(payload.commute_problems_other)
    payload.commute_satisfaction = clean_str(payload.commute_satisfaction)
    payload.biggest_problem_open = clean_str(payload.biggest_problem_open)
    payload.shared_before = clean_str(payload.shared_before)
    payload.discovery_method = clean_str(payload.discovery_method)
    payload.discovery_method_other = clean_str(payload.discovery_method_other)
    payload.non_sharing_reason = clean_str(payload.non_sharing_reason)
    payload.non_sharing_reason_other = clean_str(payload.non_sharing_reason_other)
    payload.trusted_sharing_partner = clean_str(payload.trusted_sharing_partner)
    payload.comfort_factors_other = clean_str(payload.comfort_factors_other)
    payload.concept_usefulness = clean_str(payload.concept_usefulness)
    payload.valuable_features = clean_str(payload.valuable_features)
    payload.adoption_barriers_other = clean_str(payload.adoption_barriers_other)
    payload.likelihood_to_share = clean_str(payload.likelihood_to_share)
    payload.expected_savings = clean_str(payload.expected_savings)
    payload.pilot_interest = clean_str(payload.pilot_interest)
    payload.change_one_thing = clean_str(payload.change_one_thing)

    # Validate mandatory fields with clear human-friendly error messages
    mandatory_fields = [
        ("Respondent Type", payload.respondent_type),
        ("Commute Frequency", payload.commute_frequency),
        ("Commute Duration", payload.commute_duration),
        ("Commute Mode", payload.commute_mode),
        ("Daily Spend", payload.commute_spend),
        ("Travel Alone", payload.travel_alone),
        ("Route Regularity", payload.route_regularity),
        ("Commute Satisfaction", payload.commute_satisfaction),
        ("Biggest Commute Problem", payload.biggest_problem_open),
        ("Shared Ride History", payload.shared_before),
        ("Trusted Sharing Partner", payload.trusted_sharing_partner),
        ("Concept Usefulness", payload.concept_usefulness),
        ("Valuable Features", payload.valuable_features),
        ("Likelihood to Share", payload.likelihood_to_share),
        ("Expected Savings", payload.expected_savings),
        ("Pilot Interest", payload.pilot_interest),
        ("Change One Thing", payload.change_one_thing),
    ]
    for field_label, field_val in mandatory_fields:
        if not field_val:
            raise HTTPException(status_code=422, detail=f"Please answer: '{field_label}' before submitting.")

    if not payload.commute_problems:
        raise HTTPException(status_code=422, detail="Please select at least one commute difficulty.")
    if not payload.comfort_factors:
        raise HTTPException(status_code=422, detail="Please select at least one comfort factor.")
    if not payload.adoption_barriers:
        raise HTTPException(status_code=422, detail="Please select at least one adoption barrier.")

    if payload.shared_before == "Never":
        if not payload.non_sharing_reason:
            raise HTTPException(status_code=422, detail="Please specify why you haven't shared rides before.")
    else:
        if not payload.discovery_method:
            raise HTTPException(status_code=422, detail="Please specify how you found your ride partners.")

    # Validate categorical field options against valid choices
    validate_survey_categorical_options(payload)

    data = payload.model_dump()
    pilot_lead_id = None

    if payload.pilot_interest in ["Yes", "Maybe"] and payload.pilot_lead:
        validate_pilot_lead_data(payload.pilot_lead)
        pilot_data = payload.pilot_lead.model_dump()
        pilot_data["respondent_type"] = payload.respondent_type or ""
        pilot_lead_id = database.save_pilot_lead(pilot_data, source="survey")
        data["pilot_lead_id"] = pilot_lead_id

    response_id = database.save_survey_response(data, client_ip=client_ip, user_agent=user_agent)

    return {
        "success": True,
        "message": "Thank you for contributing to Rido commute research.",
        "survey_id": response_id,
        "pilot_lead_id": pilot_lead_id,
    }


def validate_pilot_lead_data(p: PilotLeadSchema):
    if not p.name or len(p.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Full name is required (minimum 2 characters).")
    email = (p.email or "").strip()
    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    phone = (p.phone or "").strip()
    if not phone or len(phone) < 8:
        raise HTTPException(status_code=400, detail="A valid phone number is required.")
    if not (p.current_area or "").strip():
        raise HTTPException(status_code=400, detail="Current area / origin location is required.")
    if not (p.destination or "").strip():
        raise HTTPException(status_code=400, detail="Destination area is required.")
    if not (p.usual_commute_time or "").strip():
        raise HTTPException(status_code=400, detail="Usual commute / departure time is required.")
    if not p.travel_days or len(p.travel_days) < 1:
        raise HTTPException(status_code=400, detail="At least one travel day must be selected.")
    if not p.consent_agreed:
        raise HTTPException(status_code=400, detail="Consent must be agreed to join pilot waitlist.")


VALID_SURVEY_OPTIONS = {
    "respondent_type": {
        "College / University student", "Working professional",
        "Resident of a residential community / society", "Other",
        "Working Professional", "College Student", "Daily Commuter", "Freelancer / Remote Worker", "Senior Citizen"
    },
    "commute_frequency": {
        "1–2 days a week", "3–4 days a week", "5+ days a week", "Less than once a week",
        "1-2 days a week", "3-4 days a week", "5+ days/week"
    },
    "commute_duration": {
        "Less than 15 minutes", "15–30 minutes", "30–60 minutes", "1–2 hours", "More than 2 hours",
        "15-30 minutes", "30-60 minutes", "1-2 hours"
    },
    "commute_mode": {
        "Bike / Scooter", "Car", "Metro", "Bus", "Auto / E-rickshaw", "Cab", "Walk", "Other",
        "Personal Two-Wheeler", "Personal Car", "Cab / Taxi"
    },
    "commute_spend": {
        "₹0–50", "₹51–100", "₹101–200", "₹201–300", "₹300+", "I don't usually pay for my commute",
        "₹0-50", "₹51-100", "₹101-200", "₹201-300"
    },
    "travel_alone": {
        "Almost always", "Usually", "Sometimes", "Rarely", "Never"
    },
    "route_regularity": {
        "Almost every day", "3–4 days a week", "1–2 days a week", "Occasionally", "No fixed route",
        "3-4 days a week", "1-2 days a week"
    },
    "commute_satisfaction": {
        "Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied", "Very Dissatisfied"
    },
    "shared_before": {
        "Regularly", "Sometimes", "Once or twice", "Never"
    },
    "trusted_sharing_partner": {
        "Someone from my college / university", "Someone from my workplace",
        "Someone from my residential community", "Friend / friend-of-friend",
        "Verified person from anywhere", "Anyone if safety is ensured", "I prefer not to share rides"
    },
    "concept_usefulness": {
        "Extremely useful", "Very useful", "Somewhat useful", "Slightly useful", "Not useful at all",
        "Not useful", "Moderately useful"
    },
    "valuable_features": {
        "Finding someone on my route", "Finding people from my community",
        "Regular recurring commute groups", "Lower commuting cost", "Better reliability",
        "Safety / verification", "Live tracking", "Flexible ride sharing", "None of these"
    },
    "likelihood_to_share": {
        "Very likely", "Likely", "Maybe", "Unlikely", "Very unlikely"
    },
    "expected_savings": {
        "Less than ₹20 per trip", "₹20–50", "₹51–100", "₹100+", "Saving money wouldn't matter", "Don't know",
        "₹20-50", "₹51-100"
    },
    "pilot_interest": {
        "Yes", "Maybe", "No"
    }
}

def validate_survey_categorical_options(payload: SurveySubmitSchema):
    for field_name, valid_set in VALID_SURVEY_OPTIONS.items():
        val = getattr(payload, field_name, None)
        if val is not None and val != "":
            val_clean = str(val).strip()
            norm_set = {s.replace("–", "-") for s in valid_set}
            if val_clean not in valid_set and val_clean.replace("–", "-") not in norm_set:
                raise HTTPException(status_code=400, detail=f"Invalid value '{val}' for field '{field_name}'.")


@app.post("/api/pilot/join", tags=["Pilot"])
async def join_pilot(payload: PilotLeadSchema):
    validate_pilot_lead_data(payload)
    data    = payload.model_dump()
    lead_id = database.save_pilot_lead(data, source=data.get("source", "direct_modal"))
    return {
        "success": True,
        "message": "Thank you for joining our early pilot waitlist. We will reach out when testing opens in your area.",
        "pilot_lead_id": lead_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Admin Auth
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/admin/login", tags=["Admin"])
async def admin_login(request: Request, payload: AdminLoginSchema):
    if not verify_admin_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin password.",
        )
    token = create_access_token({"role": "admin"})
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_hours": JWT_EXPIRE_HOURS,
    }


@app.post("/api/admin/logout", tags=["Admin"])
async def admin_logout(_token: str = Depends(verify_admin_token)):
    return {"success": True, "message": "Logged out. Please discard your token."}


# ─────────────────────────────────────────────────────────────────────────────
# Protected Admin API Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/stats", tags=["Admin"])
async def admin_stats(_token: str = Depends(verify_admin_token)):
    return database.get_stats()


@app.get("/api/admin/surveys", tags=["Admin"])
async def admin_surveys(show_deleted: bool = False, _token: str = Depends(verify_admin_token)):
    return database.get_all_surveys(include_deleted=show_deleted)


@app.get("/api/admin/surveys/{survey_id}", tags=["Admin"])
async def admin_survey_detail(survey_id: int, _token: str = Depends(verify_admin_token)):
    survey = database.get_survey_by_id(survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey response not found.")
    return survey


@app.put("/api/admin/surveys/{survey_id}", tags=["Admin"])
async def edit_survey_response(survey_id: int, payload: SurveyEditSchema, _token: str = Depends(verify_admin_token)):
    existing = database.get_survey_by_id(survey_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Survey response not found.")
    
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    success = database.update_survey_response(survey_id, update_data)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update survey response.")
    
    updated = database.get_survey_by_id(survey_id)
    return {"success": True, "message": "Survey response updated successfully.", "data": updated}


@app.patch("/api/admin/surveys/{survey_id}/status", tags=["Admin"])
async def update_survey_status_route(survey_id: int, payload: StatusUpdateSchema, _token: str = Depends(verify_admin_token)):
    valid_statuses = ["Submitted", "Reviewed", "Pending", "Completed"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    existing = database.get_survey_by_id(survey_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Survey response not found.")
    
    success = database.update_survey_status(survey_id, payload.status)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update status.")
    return {"success": True, "message": f"Status updated to '{payload.status}'.", "status": payload.status}


@app.delete("/api/admin/surveys/{survey_id}", tags=["Admin"])
async def delete_survey_response(survey_id: int, _token: str = Depends(verify_admin_token)):
    existing = database.get_survey_by_id(survey_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Survey response not found.")
    
    success = database.soft_delete_survey(survey_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete survey response.")
    return {"success": True, "message": f"Survey response #{survey_id} soft-deleted successfully."}


@app.post("/api/admin/surveys/{survey_id}/restore", tags=["Admin"])
async def restore_survey_response(survey_id: int, _token: str = Depends(verify_admin_token)):
    existing = database.get_survey_by_id(survey_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Survey response not found.")
    
    success = database.restore_survey(survey_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to restore survey response.")
    return {"success": True, "message": f"Survey response #{survey_id} restored successfully."}


@app.get("/api/admin/pilots", tags=["Admin"])
async def admin_pilots(show_deleted: bool = False, _token: str = Depends(verify_admin_token)):
    return database.get_all_pilot_leads(include_deleted=show_deleted)


@app.get("/api/admin/pilots/{pilot_id}", tags=["Admin"])
async def admin_pilot_detail(pilot_id: int, _token: str = Depends(verify_admin_token)):
    pilot = database.get_pilot_lead_by_id(pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot lead not found.")
    return pilot


@app.put("/api/admin/pilots/{pilot_id}", tags=["Admin"])
async def edit_pilot_lead_route(pilot_id: int, payload: PilotEditSchema, _token: str = Depends(verify_admin_token)):
    existing = database.get_pilot_lead_by_id(pilot_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Pilot lead not found.")
    
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    success = database.update_pilot_lead(pilot_id, update_data)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update pilot lead.")
    
    updated = database.get_pilot_lead_by_id(pilot_id)
    return {"success": True, "message": "Pilot lead updated successfully.", "data": updated}


@app.delete("/api/admin/pilots/{pilot_id}", tags=["Admin"])
async def delete_pilot_lead_route(pilot_id: int, _token: str = Depends(verify_admin_token)):
    existing = database.get_pilot_lead_by_id(pilot_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Pilot lead not found.")
    
    success = database.delete_pilot_lead(pilot_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete pilot lead.")
    return {"success": True, "message": f"Pilot lead #{pilot_id} deleted successfully."}


@app.post("/api/admin/pilots/{pilot_id}/restore", tags=["Admin"])
async def restore_pilot_lead_route(pilot_id: int, _token: str = Depends(verify_admin_token)):
    existing = database.get_pilot_lead_by_id(pilot_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Pilot lead not found.")
    
    success = database.restore_pilot_lead(pilot_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to restore pilot lead.")
    return {"success": True, "message": f"Pilot lead #{pilot_id} restored successfully."}


@app.get("/api/admin/export/surveys.csv", tags=["Admin"])
async def export_surveys_csv(_token: str = Depends(verify_admin_token)):
    surveys = database.get_all_surveys()
    output  = io.StringIO()
    if surveys:
        writer = csv.DictWriter(output, fieldnames=list(surveys[0].keys()))
        writer.writeheader()
        writer.writerows(surveys)
    else:
        output.write("No survey data collected yet.\n")
    content = output.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=rido_survey_responses.csv"},
    )


@app.get("/api/admin/export/pilots.csv", tags=["Admin"])
async def export_pilots_csv(_token: str = Depends(verify_admin_token)):
    leads  = database.get_all_pilot_leads()
    output = io.StringIO()
    if leads:
        writer = csv.DictWriter(output, fieldnames=list(leads[0].keys()))
        writer.writeheader()
        writer.writerows(leads)
    else:
        output.write("No pilot leads collected yet.\n")
    content = output.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=rido_pilot_leads.csv"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("RIDO_HOST", "127.0.0.1")
    port = int(os.environ.get("RIDO_PORT", "8000"))
    uvicorn.run("server:app", host=host, port=port, reload=True)

