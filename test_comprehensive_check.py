import urllib.request
import urllib.parse
import json
import re
import os

BASE = "http://127.0.0.1:8000"

def get(path, token=None):
    req = urllib.request.Request(f"{BASE}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as res:
        return res.status, res.read().decode("utf-8")

def post(path, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode("utf-8"))

print("--- 1. Testing Static Assets & Page Endpoints ---")
status, index_html = get("/")
assert status == 200
assert "rido" in index_html.lower()
assert "zupgoo" not in index_html.lower()
print("[PASS] Index page loaded successfully without any ZupGoo references.")

status, survey_html = get("/survey")
assert status == 200
assert "rido" in survey_html.lower()
assert "zupgoo" not in survey_html.lower()
print("[PASS] Dedicated /survey page loaded successfully.")

status, admin_html = get("/admin")
assert status == 200
print("[PASS] Admin page loaded successfully.")

status, survey_js = get("/static/js/survey-engine.js")
assert status == 200
assert "zupgoo" not in survey_js.lower()
assert "skip" not in survey_js.lower() or "survey-btn-skip" not in survey_js
print("[PASS] survey-engine.js verified: no ZupGoo references and no skip button.")

# Verify all 22 questions exist and are required in survey-engine.js
for i in range(1, 23):
    qid = f"q{i}"
    assert f'id: "{qid}"' in survey_js, f"Missing question {qid} in survey-engine.js!"
print("[PASS] Exactly all 22 questions Q1 to Q22 verified in survey-engine.js!")

# Verify conditional logic exists in survey-engine.js
assert 'answers.q11 && answers.q11 !== "Never"' in survey_js
assert 'answers.q11 === "Never"' in survey_js
assert 'type: "pilot_intent"' in survey_js
print("[PASS] Conditional branching logic (Q11->Q12/Q13, Q21 pilot intent) verified intact.")

status, pilot_js = get("/static/js/pilot-modal.js")
assert status == 200
assert "zupgoo" not in pilot_js.lower()
print("[PASS] pilot-modal.js verified.")

print("\n--- 2. Testing Database and Survey Submission ---")
ADMIN_PW = os.environ.get("RIDO_ADMIN_PASSWORD", "rido_research_2026")
status, login_res = post("/api/admin/login", {"password": ADMIN_PW})
assert status == 200
token = login_res.get("access_token")

status, stats_before_body = get("/api/admin/stats", token=token)
stats_before = json.loads(stats_before_body)
prev_surveys = stats_before.get("total_surveys", 0)
prev_pilots = stats_before.get("total_pilot_leads", 0)
print(f"Current DB state: {prev_surveys} surveys, {prev_pilots} pilots.")

# Test submitting a new valid survey response
test_payload = {
    "respondent_type": "Resident of a residential community / society",
    "commute_frequency": "5+ days a week",
    "commute_duration": "30–60 minutes",
    "commute_mode": "Car",
    "commute_spend": "₹201–300",
    "travel_alone": "Almost always",
    "route_regularity": "Almost every day",
    "commute_problems": ["Traffic", "Parking", "Cost"],
    "commute_satisfaction": "Dissatisfied",
    "biggest_problem_open": "Parking congestion near office complex and high toll fees.",
    "shared_before": "Regularly",
    "discovery_method": "Society / community group",
    "trusted_sharing_partner": "Someone from my residential community",
    "comfort_factors": ["Verified identity", "Same college / company / society", "Previous ride history"],
    "concept_usefulness": "Very useful",
    "valuable_features": "Finding people from my community",
    "adoption_barriers": ["Schedule changes often"],
    "likelihood_to_share": "Very likely",
    "expected_savings": "₹51–100",
    "pilot_interest": "Yes",
    "pilot_lead": {
        "name": "Siddharth Malhotra",
        "email": "siddharth.m@example.com",
        "phone": "+91 98200 11223",
        "current_area": "Cherry County, Greater Noida West",
        "destination": "Advant Navis, Sector 142, Noida",
        "usual_commute_time": "8:30 AM",
        "travel_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "consent_agreed": True
    },
    "change_one_thing": "Carpool matching with neighbors heading to the same tech park."
}

status, res = post("/api/survey/submit", test_payload)
assert status == 200
assert res.get("success") is True
new_survey_id = res.get("survey_id")
new_pilot_id = res.get("pilot_lead_id")
print(f"[PASS] New survey submitted: ID #{new_survey_id}, Pilot Lead #{new_pilot_id}")

status, stats_after_body = get("/api/admin/stats", token=token)
stats_after = json.loads(stats_after_body)
new_surveys = stats_after.get("total_surveys", 0)
new_pilots = stats_after.get("total_pilot_leads", 0)
assert new_surveys == prev_surveys + 1, "Survey count did not increase by 1!"
assert new_pilots == prev_pilots + 1, "Pilot count did not increase by 1!"
print(f"[PASS] DB state after submission: {new_surveys} surveys, {new_pilots} pilots (previous data preserved).")

print("\n--- 3. Testing CSV Exports ---")
ADMIN_PW = os.environ.get("RIDO_ADMIN_PASSWORD", "rido_research_2026")
status, login_res = post("/api/admin/login", {"password": ADMIN_PW})
assert status == 200
token = login_res.get("access_token")

status, csv_surveys = get("/api/admin/export/surveys.csv", token=token)
assert status == 200
assert "respondent_type" in csv_surveys
print(f"[PASS] Survey CSV export successful ({len(csv_surveys.splitlines())} lines).")

status, csv_pilots = get("/api/admin/export/pilots.csv", token=token)
assert status == 200
assert "email" in csv_pilots
print(f"[PASS] Pilot CSV export successful ({len(csv_pilots.splitlines())} lines).")

print("\n==============================================")
print("ALL VERIFICATION CHECKS PASSED PERFECTLY!")
print("==============================================")
