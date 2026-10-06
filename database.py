import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from pymongo import MongoClient, ReturnDocument
from dotenv import load_dotenv

load_dotenv(override=True)

RIDO_ENV = os.environ.get("RIDO_ENV", os.environ.get("ENVIRONMENT", "development")).lower()

# Re-use single MongoClient instance across the application
_client = None
_db = None
_db_name_cached = None

def get_db():
    global _client, _db, _db_name_cached
    uri = os.environ.get("MONGODB_URI", "").strip()
    db_name = os.environ.get("MONGODB_DB_NAME", "surveydb").strip() or "surveydb"

    if RIDO_ENV == "production" and not uri:
        raise RuntimeError("CRITICAL CONFIG ERROR: MONGODB_URI environment variable must be set in production.")

    if _client is None or _db_name_cached != db_name:
        if uri:
            _client = MongoClient(
                uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                socketTimeoutMS=10000,
                retryWrites=True
            )
        else:
            # Fallback to mongomock for local development/testing when MONGODB_URI is not provided
            try:
                import mongomock
                _client = mongomock.MongoClient()
            except ImportError:
                _client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=5000)
                
        _db = _client[db_name]
        _db_name_cached = db_name

    return _db

def get_next_sequence_value(sequence_name: str) -> int:
    db = get_db()
    result = db.counters.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return result["seq"]

def init_db():
    db = get_db()
    try:
        db.survey_responses.create_index("id", unique=True)
        db.survey_responses.create_index("session_id", sparse=True)
        db.survey_responses.create_index("is_deleted")
        db.survey_responses.create_index("timestamp")

        db.pilot_leads.create_index("id", unique=True)
        db.pilot_leads.create_index("is_deleted")
        db.pilot_leads.create_index("timestamp")
    except Exception:
        pass

def save_survey_response(data: Dict[str, Any], client_ip: str = "", user_agent: str = "") -> int:
    db = get_db()
    
    session_id = data.get("session_id") or f"sess_{datetime.utcnow().timestamp()}_{os.urandom(4).hex()}"

    # Check for existing session_id deduplication
    if data.get("session_id"):
        existing = db.survey_responses.find_one({"session_id": data["session_id"]}, {"id": 1})
        if existing:
            return existing["id"]
    
    def to_json_str(val):
        if isinstance(val, list):
            return json.dumps(val)
        return val or "[]"

    problems = to_json_str(data.get("commute_problems"))
    comfort = to_json_str(data.get("comfort_factors"))
    barriers = to_json_str(data.get("adoption_barriers"))
    
    response_id = get_next_sequence_value("survey_responses_id")
    timestamp = datetime.utcnow().isoformat()

    doc = {
        "id": response_id,
        "timestamp": timestamp,
        "session_id": session_id,
        "respondent_type": data.get("respondent_type"),
        "respondent_type_other": data.get("respondent_type_other"),
        "commute_frequency": data.get("commute_frequency"),
        "commute_duration": data.get("commute_duration"),
        "commute_mode": data.get("commute_mode"),
        "commute_mode_other": data.get("commute_mode_other"),
        "commute_spend": data.get("commute_spend"),
        "travel_alone": data.get("travel_alone"),
        "route_regularity": data.get("route_regularity"),
        "commute_problems": problems,
        "commute_problems_other": data.get("commute_problems_other"),
        "commute_satisfaction": data.get("commute_satisfaction"),
        "biggest_problem_open": data.get("biggest_problem_open"),
        "shared_before": data.get("shared_before"),
        "discovery_method": data.get("discovery_method"),
        "discovery_method_other": data.get("discovery_method_other"),
        "non_sharing_reason": data.get("non_sharing_reason"),
        "non_sharing_reason_other": data.get("non_sharing_reason_other"),
        "trusted_sharing_partner": data.get("trusted_sharing_partner"),
        "comfort_factors": comfort,
        "comfort_factors_other": data.get("comfort_factors_other"),
        "concept_usefulness": data.get("concept_usefulness"),
        "valuable_features": data.get("valuable_features"),
        "adoption_barriers": barriers,
        "adoption_barriers_other": data.get("adoption_barriers_other"),
        "likelihood_to_share": data.get("likelihood_to_share"),
        "expected_savings": data.get("expected_savings"),
        "pilot_interest": data.get("pilot_interest"),
        "pilot_lead_id": data.get("pilot_lead_id"),
        "change_one_thing": data.get("change_one_thing"),
        "user_agent": user_agent,
        "ip_address": client_ip,
        "status": "Submitted",
        "is_deleted": 0,
        "deleted_at": None,
        "updated_at": None,
        "admin_notes": None
    }
    db.survey_responses.insert_one(doc)
    return response_id

def save_pilot_lead(data: Dict[str, Any], source: str = "direct_modal") -> int:
    db = get_db()
    
    lead_id = get_next_sequence_value("pilot_leads_id")
    timestamp = datetime.utcnow().isoformat()
    
    travel_days_data = data.get("travel_days", [])
    if isinstance(travel_days_data, list):
        travel_days_str = json.dumps(travel_days_data)
    else:
        travel_days_str = str(travel_days_data).strip()

    doc = {
        "id": lead_id,
        "timestamp": timestamp,
        "name": data.get("name", "").strip(),
        "email": data.get("email", "").strip().lower(),
        "phone": data.get("phone", "").strip(),
        "current_area": data.get("current_area", "").strip(),
        "destination": data.get("destination", "").strip(),
        "usual_commute_time": data.get("usual_commute_time", "").strip(),
        "travel_days": travel_days_str,
        "consent_agreed": 1 if data.get("consent_agreed", True) else 0,
        "source": source,
        "respondent_type": data.get("respondent_type", ""),
        "notes": data.get("notes", ""),
        "is_deleted": 0
    }
    db.pilot_leads.insert_one(doc)
    return lead_id

def get_stats() -> Dict[str, Any]:
    db = get_db()
    
    total_surveys = db.survey_responses.count_documents({"is_deleted": 0})
    total_pilot_leads = db.pilot_leads.count_documents({"is_deleted": 0})
    status_submitted = db.survey_responses.count_documents({"status": "Submitted", "is_deleted": 0})
    status_reviewed = db.survey_responses.count_documents({"status": "Reviewed", "is_deleted": 0})
    
    def group_count(field_name):
        pipeline = [
            {"$match": {"is_deleted": 0}},
            {"$group": {"_id": f"${field_name}", "count": {"$sum": 1}}}
        ]
        results = {}
        for row in db.survey_responses.aggregate(pipeline):
            key = row["_id"] or "Unspecified"
            results[key] = row["count"]
        return results

    profile_breakdown = group_count("respondent_type")
    mode_breakdown = group_count("commute_mode")
    concept_feedback = group_count("concept_usefulness")
    pilot_interest = group_count("pilot_interest")

    return {
        "total_surveys": total_surveys,
        "total_pilot_leads": total_pilot_leads,
        "status_submitted": status_submitted,
        "status_reviewed": status_reviewed,
        "profile_breakdown": profile_breakdown,
        "mode_breakdown": mode_breakdown,
        "concept_feedback": concept_feedback,
        "pilot_interest": pilot_interest
    }

def get_all_surveys(include_deleted: bool = False) -> List[Dict[str, Any]]:
    db = get_db()
    query = {} if include_deleted else {"is_deleted": 0}
    cursor = db.survey_responses.find(query, {"_id": 0}).sort("id", -1)
    return list(cursor)

def get_all_pilot_leads(include_deleted: bool = False) -> List[Dict[str, Any]]:
    db = get_db()
    query = {} if include_deleted else {"is_deleted": 0}
    cursor = db.pilot_leads.find(query, {"_id": 0}).sort("id", -1)
    return list(cursor)

def get_survey_by_id(survey_id: int) -> Optional[Dict[str, Any]]:
    db = get_db()
    doc = db.survey_responses.find_one({"id": survey_id}, {"_id": 0})
    return doc

def update_survey_response(survey_id: int, data: Dict[str, Any]) -> bool:
    db = get_db()
    updated_at = datetime.utcnow().isoformat()
    allowed_fields = [
        "respondent_type", "commute_frequency", "commute_duration", "commute_mode",
        "commute_spend", "travel_alone", "route_regularity", "commute_satisfaction",
        "biggest_problem_open", "shared_before", "discovery_method", "non_sharing_reason",
        "trusted_sharing_partner", "concept_usefulness", "valuable_features",
        "likelihood_to_share", "expected_savings", "pilot_interest", "change_one_thing",
        "status", "admin_notes"
    ]
    set_dict = {"updated_at": updated_at}
    for field in allowed_fields:
        if field in data and data[field] is not None:
            set_dict[field] = data[field]
            
    res = db.survey_responses.update_one({"id": survey_id}, {"$set": set_dict})
    return res.matched_count > 0

def update_survey_status(survey_id: int, status_val: str) -> bool:
    db = get_db()
    updated_at = datetime.utcnow().isoformat()
    res = db.survey_responses.update_one({"id": survey_id}, {"$set": {"status": status_val, "updated_at": updated_at}})
    return res.matched_count > 0

def soft_delete_survey(survey_id: int) -> bool:
    db = get_db()
    deleted_at = datetime.utcnow().isoformat()
    res = db.survey_responses.update_one({"id": survey_id}, {"$set": {"is_deleted": 1, "deleted_at": deleted_at}})
    return res.matched_count > 0

def restore_survey(survey_id: int) -> bool:
    db = get_db()
    res = db.survey_responses.update_one({"id": survey_id}, {"$set": {"is_deleted": 0, "deleted_at": None}})
    return res.matched_count > 0

def get_pilot_lead_by_id(lead_id: int) -> Optional[Dict[str, Any]]:
    db = get_db()
    doc = db.pilot_leads.find_one({"id": lead_id}, {"_id": 0})
    return doc

def update_pilot_lead(lead_id: int, data: Dict[str, Any]) -> bool:
    db = get_db()
    allowed_fields = [
        "name", "email", "phone", "current_area", "destination",
        "usual_commute_time", "travel_days", "consent_agreed",
        "respondent_type", "notes", "source"
    ]
    set_dict = {}
    for field in allowed_fields:
        if field in data and data[field] is not None:
            val = data[field]
            if field == "travel_days" and isinstance(val, list):
                val = json.dumps(val)
            elif field == "consent_agreed":
                val = 1 if val else 0
            set_dict[field] = val

    if not set_dict:
        return False

    res = db.pilot_leads.update_one({"id": lead_id}, {"$set": set_dict})
    return res.matched_count > 0

def delete_pilot_lead(lead_id: int) -> bool:
    db = get_db()
    res = db.pilot_leads.update_one({"id": lead_id}, {"$set": {"is_deleted": 1}})
    return res.matched_count > 0

def restore_pilot_lead(lead_id: int) -> bool:
    db = get_db()
    res = db.pilot_leads.update_one({"id": lead_id}, {"$set": {"is_deleted": 0}})
    return res.matched_count > 0
