import urllib.request
import urllib.parse
import json
import os

BASE = "http://127.0.0.1:8000"

def get(path, token=None):
    req = urllib.request.Request(f"{BASE}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as res:
        return res.status, res.read()

def post(path, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode("utf-8"))

def put(path, data, token=None):
    body = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=headers, method="PUT")
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode("utf-8"))

def delete_req(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", headers=headers, method="DELETE")
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode("utf-8"))

print("1. Testing GET /")
s, b = get("/")
print(f"Status: {s}, Body length: {len(b)}")
assert s == 200

print("2. Testing GET /survey")
s, b = get("/survey")
print(f"Status: {s}, Body length: {len(b)}")
assert s == 200

print("3. Testing GET /admin")
s, b = get("/admin")
print(f"Status: {s}, Body length: {len(b)}")
assert s == 200

print("4. Testing POST /api/pilot/join")
pilot_payload = {
    "name": "Meera Kapoor",
    "email": "meera.kapoor@example.com",
    "phone": "+91 99887 76655",
    "current_area": "Indirapuram, Ghaziabad",
    "destination": "Cyber City, Gurugram",
    "usual_commute_time": "8:00 AM",
    "travel_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "consent_agreed": True,
    "respondent_type": "Working professional"
}
s, res = post("/api/pilot/join", pilot_payload)
print(f"Status: {s}, Pilot Lead ID: {res.get('pilot_lead_id')}")
assert s == 200 and res.get("pilot_lead_id") is not None
test_pilot_id = res.get("pilot_lead_id")

print("5. Testing POST /api/survey/submit")
survey_payload = {
    "respondent_type": "Working professional",
    "commute_frequency": "5+ days a week",
    "commute_duration": "1–2 hours",
    "commute_mode": "Cab",
    "commute_spend": "₹300+",
    "travel_alone": "Usually",
    "route_regularity": "Almost every day",
    "commute_problems": ["Cost", "Traffic", "Travel time"],
    "commute_satisfaction": "Dissatisfied",
    "biggest_problem_open": "Spending over ₹12,000 every month on peak-hour cabs.",
    "shared_before": "Never",
    "non_sharing_reason": "Safety concerns",
    "trusted_sharing_partner": "Someone from my workplace",
    "comfort_factors": ["Verified identity", "Same college / company / society", "Emergency / SOS"],
    "concept_usefulness": "Extremely useful",
    "valuable_features": "Lower commuting cost",
    "adoption_barriers": ["Safety concerns", "Waiting / coordination"],
    "likelihood_to_share": "Likely",
    "expected_savings": "₹100+",
    "pilot_interest": "Yes",
    "pilot_lead": {
        "name": "Kunal Verma",
        "email": "kunal.verma@example.com",
        "phone": "+91 98111 22334",
        "current_area": "Sector 137, Noida",
        "destination": "Cyber City, Gurugram",
        "usual_commute_time": "8:15 AM",
        "travel_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "consent_agreed": True
    },
    "change_one_thing": "More affordable, guaranteed recurring seats with verified colleagues."
}
s, res = post("/api/survey/submit", survey_payload)
print(f"Status: {s}, Survey ID: {res.get('survey_id')}, Pilot Lead ID: {res.get('pilot_lead_id')}")
assert s == 200 and res.get("survey_id") is not None

print("6. Testing Admin Security (Unauthenticated calls should fail)")
try:
    get("/api/admin/pilots")
    assert False, "Should have failed without auth token!"
except urllib.error.HTTPError as err:
    assert err.code == 401
    print("Unauthenticated GET /api/admin/pilots correctly rejected with 401 Unauthorized.")

print("7. Testing Admin Login & Token Retrieval")
ADMIN_PW = os.environ.get("RIDO_ADMIN_PASSWORD", "rido_research_2026")
s, login_res = post("/api/admin/login", {"password": ADMIN_PW})
assert s == 200
token = login_res.get("access_token")
assert token is not None

print("8. Testing GET /api/admin/stats")
s, b = get("/api/admin/stats", token=token)
stats = json.loads(b.decode("utf-8"))
print(f"Status: {s}, Surveys: {stats['total_surveys']}, Pilots: {stats['total_pilot_leads']}")
assert stats['total_surveys'] >= 1

print("9. Testing GET /api/admin/pilots/{id}")
s, b = get(f"/api/admin/pilots/{test_pilot_id}", token=token)
pilot_detail = json.loads(b.decode("utf-8"))
assert pilot_detail.get("name") == "Meera Kapoor"
print(f"[PASS] Pilot lead detail retrieved for #{test_pilot_id}: {pilot_detail.get('name')}")

print("10. Testing PUT /api/admin/pilots/{id}")
s, edit_res = put(f"/api/admin/pilots/{test_pilot_id}", {"name": "Meera Kapoor Sharma", "usual_commute_time": "8:30 AM"}, token=token)
assert s == 200 and edit_res.get("success") is True
print(f"[PASS] Pilot lead updated: {edit_res['data']['name']}")

print("11. Testing DELETE /api/admin/pilots/{id}")
s, del_res = delete_req(f"/api/admin/pilots/{test_pilot_id}", token=token)
assert s == 200 and del_res.get("success") is True
print(f"[PASS] Pilot lead #{test_pilot_id} deleted successfully.")

print("12. Testing CSV Export for Surveys & Pilots")
s, b = get("/api/admin/export/surveys.csv", token=token)
assert s == 200 and len(b) > 50
s, b = get("/api/admin/export/pilots.csv", token=token)
assert s == 200 and len(b) > 50

print("\nALL HTTP ENDPOINTS, PILOT CRUD & SECURITY TESTED SUCCESSFULLY!")
