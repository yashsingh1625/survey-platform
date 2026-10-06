import database
import json

def test_db_and_flow():
    print("1. Initializing DB...")
    database.init_db()
    
    print("2. Testing pilot lead insertion...")
    pilot_lead_id = database.save_pilot_lead({
        "name": "Arjun Patel",
        "email": "arjun.patel@example.com",
        "phone": "+91 98765 01234",
        "current_area": "Knowledge Park II, Greater Noida",
        "destination": "Galgotias University",
        "usual_commute_time": "8:30 AM",
        "travel_days": "Mon-Fri",
        "consent_agreed": True,
        "respondent_type": "College / University student",
        "notes": "Testing pilot insertion"
    }, source="test_script")
    print(f"Pilot lead inserted with ID: {pilot_lead_id}")
    assert pilot_lead_id > 0

    print("3. Testing survey response insertion...")
    survey_id = database.save_survey_response({
        "session_id": "test_session_001",
        "respondent_type": "College / University student",
        "commute_frequency": "5+ days a week",
        "commute_duration": "30–60 minutes",
        "commute_mode": "Auto / E-rickshaw",
        "commute_spend": "₹101–200",
        "travel_alone": "Almost always",
        "route_regularity": "Almost every day",
        "commute_problems": ["Cost", "Travel time", "Finding reliable transport"],
        "commute_satisfaction": "Dissatisfied",
        "biggest_problem_open": "Surge pricing in auto rickshaws during peak morning hours.",
        "shared_before": "Sometimes",
        "discovery_method": "WhatsApp group",
        "trusted_sharing_partner": "Someone from my college / university",
        "comfort_factors": ["Verified identity", "Same college / company / society", "Live location sharing"],
        "concept_usefulness": "Very useful",
        "valuable_features": "Regular recurring commute groups",
        "adoption_barriers": ["Waiting / coordination", "Schedule changes often"],
        "likelihood_to_share": "Very likely",
        "expected_savings": "₹51–100",
        "pilot_interest": "Yes",
        "pilot_lead_id": pilot_lead_id,
        "change_one_thing": "Affordable predictable morning carpool with fellow students"
    }, client_ip="127.0.0.1", user_agent="Mozilla/5.0 Test")
    print(f"Survey response inserted with ID: {survey_id}")
    assert survey_id > 0

    print("4. Testing stats calculation...")
    stats = database.get_stats()
    print("Stats output:", json.dumps(stats, indent=2))
    assert stats["total_surveys"] >= 1
    assert stats["total_pilot_leads"] >= 1

    print("5. Testing survey retrieval...")
    surveys = database.get_all_surveys()
    assert len(surveys) >= 1
    print(f"Retrieved {len(surveys)} surveys. Sample respondent type: {surveys[0]['respondent_type']}")

    print("6. Testing pilot leads retrieval...")
    leads = database.get_all_pilot_leads()
    assert len(leads) >= 1
    print(f"Retrieved {len(leads)} leads. Sample applicant: {leads[0]['name']}")

    print("\nALL DATABASE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_db_and_flow()
