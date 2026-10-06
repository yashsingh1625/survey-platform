/**
 * Rido Mobility Research Survey Engine
 * Reliable, mandatory 22-question research survey engine with conditional branching,
 * multi-select capping, draft local storage, keyboard navigation, race-condition guards,
 * and responsive touch controls.
 * Single source of truth: 22 exact Rido survey questions.
 */

(function () {
  const STORAGE_KEY = "rido_survey_draft_v1";

  function escHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Exact 22 Survey Questions (Source of Truth)
  const SURVEY_QUESTIONS = [
    {
      id: "q1",
      number: 1,
      section: "SECTION A — USER PROFILE",
      title: "Which best describes you?",
      type: "single",
      required: true,
      options: [
        "College / University student",
        "Working professional",
        "Resident of a residential community / society",
        "Other"
      ],
      hasOtherText: true
    },
    {
      id: "q2",
      number: 2,
      section: "SECTION A — USER PROFILE",
      title: "How often do you travel for college or work?",
      type: "single",
      required: true,
      options: [
        "1–2 days a week",
        "3–4 days a week",
        "5+ days a week",
        "Less than once a week"
      ]
    },
    {
      id: "q3",
      number: 3,
      section: "SECTION B — ACTUAL COMMUTE",
      title: "What is your usual one-way commute time?",
      type: "single",
      required: true,
      options: [
        "Less than 15 minutes",
        "15–30 minutes",
        "30–60 minutes",
        "1–2 hours",
        "More than 2 hours"
      ]
    },
    {
      id: "q4",
      number: 4,
      section: "SECTION B — ACTUAL COMMUTE",
      title: "What do you usually use for your commute?",
      type: "single",
      required: true,
      options: [
        "Bike / Scooter",
        "Car",
        "Metro",
        "Bus",
        "Auto / E-rickshaw",
        "Cab",
        "Walk",
        "Other"
      ],
      hasOtherText: true
    },
    {
      id: "q5",
      number: 5,
      section: "SECTION B — ACTUAL COMMUTE",
      title: "Approximately how much do you spend on your daily commute?",
      type: "single",
      required: true,
      options: [
        "₹0–50",
        "₹51–100",
        "₹101–200",
        "₹201–300",
        "₹300+",
        "I don't usually pay for my commute"
      ]
    },
    {
      id: "q6",
      number: 6,
      section: "SECTION B — ACTUAL COMMUTE",
      title: "Do you usually travel alone?",
      type: "single",
      required: true,
      options: [
        "Almost always",
        "Usually",
        "Sometimes",
        "Rarely",
        "Never"
      ]
    },
    {
      id: "q7",
      number: 7,
      section: "SECTION B — ACTUAL COMMUTE",
      title: "Do you travel the same route regularly?",
      type: "single",
      required: true,
      options: [
        "Almost every day",
        "3–4 days a week",
        "1–2 days a week",
        "Occasionally",
        "No fixed route"
      ]
    },
    {
      id: "q8",
      number: 8,
      section: "SECTION C — REAL PROBLEMS",
      title: "What are the biggest difficulties with your current commute?",
      subtitle: "Select up to 3 options that affect you most",
      type: "multi",
      maxSelect: 3,
      required: true,
      options: [
        "Cost",
        "Travel time",
        "Traffic",
        "Finding reliable transport",
        "Public transport availability",
        "Last-mile connectivity",
        "Safety",
        "Parking",
        "Uncomfortable travel",
        "Lack of flexibility",
        "I don't face any major problem",
        "Other"
      ],
      hasOtherText: true
    },
    {
      id: "q9",
      number: 9,
      section: "SECTION C — REAL PROBLEMS",
      title: "How satisfied are you with your current commute?",
      type: "single",
      required: true,
      options: [
        "Very dissatisfied",
        "Dissatisfied",
        "Neutral",
        "Satisfied",
        "Very satisfied"
      ]
    },
    {
      id: "q10",
      number: 10,
      section: "SECTION C — REAL PROBLEMS",
      title: "Tell us about the biggest problem you've faced during your regular commute.",
      subtitle: "Required · Your real experience matters to us",
      type: "text",
      required: true,
      placeholder: "Example: expensive daily travel, unreliable transport, long waiting time, etc."
    },
    {
      id: "q11",
      number: 11,
      section: "SECTION D — EXISTING BEHAVIOUR",
      title: "Have you ever shared a ride with someone travelling in the same direction?",
      type: "single",
      required: true,
      options: [
        "Regularly",
        "Sometimes",
        "Once or twice",
        "Never"
      ]
    },
    {
      id: "q12",
      number: 12,
      section: "SECTION D — EXISTING BEHAVIOUR",
      title: "How did you find them?",
      subtitle: "Based on your past ride sharing",
      type: "single",
      condition: (answers) => answers.q11 && answers.q11 !== "Never",
      required: true,
      options: [
        "Friend",
        "College group",
        "Workplace group",
        "WhatsApp group",
        "Society / community group",
        "Social media",
        "Ride-sharing app",
        "Family / relative",
        "Other"
      ],
      hasOtherText: true
    },
    {
      id: "q13",
      number: 13,
      section: "SECTION D — EXISTING BEHAVIOUR",
      title: "What is the main reason you haven't shared rides?",
      subtitle: "Help us understand the barriers you face",
      type: "single",
      condition: (answers) => answers.q11 === "Never",
      required: true,
      options: [
        "Safety concerns",
        "I don't know anyone travelling my route",
        "Privacy concerns",
        "I prefer travelling alone",
        "Not enough cost saving",
        "Inconvenient",
        "I don't trust strangers",
        "Never considered it",
        "Other"
      ],
      hasOtherText: true
    },
    {
      id: "q14",
      number: 14,
      section: "SECTION E — COMMUNITY & TRUST",
      title: "Who would you feel most comfortable sharing a regular commute with?",
      type: "single",
      required: true,
      options: [
        "Someone from my college / university",
        "Someone from my workplace",
        "Someone from my residential community",
        "Friend / friend-of-friend",
        "Verified person from anywhere",
        "Anyone if safety is ensured",
        "I prefer not to share rides"
      ]
    },
    {
      id: "q15",
      number: 15,
      section: "SECTION E — COMMUNITY & TRUST",
      title: "What would make you more comfortable sharing a regular commute?",
      subtitle: "Select up to 3 options that matter most to you",
      type: "multi",
      maxSelect: 3,
      required: true,
      options: [
        "Verified identity",
        "Same college / company / society",
        "Ratings and reviews",
        "Previous ride history",
        "Mutual connections",
        "Live location sharing",
        "Emergency / SOS",
        "Knowing the person beforehand",
        "Clear profile information",
        "Nothing would make me comfortable",
        "Other"
      ],
      hasOtherText: true
    },
    {
      id: "concept_interstitial",
      section: "EXPLORING THE CONCEPT",
      type: "interstitial",
      isConceptCard: true
    },
    {
      id: "q16",
      number: 16,
      section: "SECTION F — CONCEPT VALIDATION",
      title: "How useful would this concept be for your regular commute?",
      type: "single",
      required: true,
      options: [
        "Extremely useful",
        "Very useful",
        "Somewhat useful",
        "Slightly useful",
        "Not useful at all"
      ]
    },
    {
      id: "q17",
      number: 17,
      section: "SECTION F — CONCEPT VALIDATION",
      title: "Which part would be most valuable to you?",
      type: "single",
      required: true,
      options: [
        "Finding someone on my route",
        "Finding people from my community",
        "Regular recurring commute groups",
        "Lower commuting cost",
        "Better reliability",
        "Safety / verification",
        "Live tracking",
        "Flexible ride sharing",
        "None of these"
      ]
    },
    {
      id: "q18",
      number: 18,
      section: "SECTION F — CONCEPT VALIDATION",
      title: "What would be the biggest reason you might NOT use something like this?",
      subtitle: "Select up to 3 options",
      type: "multi",
      maxSelect: 3,
      required: true,
      options: [
        "Safety concerns",
        "Privacy concerns",
        "Not enough people on my route",
        "Waiting / coordination",
        "Savings wouldn't be enough",
        "I prefer travelling alone",
        "I don't trust verification",
        "My schedule changes often",
        "I don't want to depend on others",
        "No major concern",
        "Other"
      ],
      hasOtherText: true
    },
    {
      id: "q19",
      number: 19,
      section: "SECTION G — INTENT & PILOT",
      title: "If someone you trusted travelled your route at a similar time, how likely would you be to share a regular commute?",
      type: "single",
      required: true,
      options: [
        "Very likely",
        "Likely",
        "Maybe",
        "Unlikely",
        "Very unlikely"
      ]
    },
    {
      id: "q20",
      number: 20,
      section: "SECTION G — INTENT & PILOT",
      title: "How much would you expect to save from sharing a regular commute?",
      type: "single",
      required: true,
      options: [
        "Less than ₹20 per trip",
        "₹20–50",
        "₹51–100",
        "₹100+",
        "Saving money wouldn't matter",
        "Don't know"
      ]
    },
    {
      id: "q21",
      number: 21,
      section: "SECTION G — INTENT & PILOT",
      title: "If you could change ONE thing about your current commute, what would it be?",
      subtitle: "Required · Any thought or suggestion welcome",
      type: "text",
      required: true,
      placeholder: "Share your thoughts freely..."
    },
    {
      id: "q22",
      number: 22,
      section: "SECTION G — INTENT & PILOT",
      title: "Would you be interested in joining an early Rido pilot?",
      subtitle: "Help us test recurring commute groups in selected locations",
      type: "pilot_intent",
      required: true,
      options: ["Yes", "Maybe", "No"]
    }
  ];

  class SurveyApp {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.answers = this.loadDraft() || {};
      this.currentStepIndex = 0;
      this.validationError = "";
      this.isSubmitting = false;
      this.autoAdvanceTimer = null;

      this.init();
    }

    loadDraft() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        return {};
      }
    }

    saveDraft() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.answers));
      } catch (e) {}
    }

    clearDraft() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }

    getActiveQuestions() {
      return SURVEY_QUESTIONS.filter(q => {
        if (typeof q.condition === "function") {
          return q.condition(this.answers);
        }
        return true;
      });
    }

    init() {
      this.render();
      window.addEventListener("keydown", (e) => this.handleKeyboard(e));
    }

    scrollIntoViewIfNeeded() {
      // Defer until after the browser has painted the new DOM.
      // Only scroll if the container is actually outside the visible fold —
      // avoids the stale getBoundingClientRect read that caused the jump to page top.
      requestAnimationFrame(() => {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        // rect.top < 0  → container scrolled above viewport
        // rect.top > innerHeight * 0.55 → container below the fold
        if (rect.top < 0 || rect.top > window.innerHeight * 0.55) {
          const targetY = window.pageYOffset + rect.top - 80;
          window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
        }
        // If already visible, do NOT scroll at all.
      });
    }

    render() {
      const activeQuestions = this.getActiveQuestions();
      if (this.currentStepIndex >= activeQuestions.length) {
        this.renderReviewOrSubmit();
        return;
      }

      const q = activeQuestions[this.currentStepIndex];
      const totalSteps = activeQuestions.length;
      
      const qLabel = q.number ? `Question ${q.number} of 22` : "Concept Overview";
      const progressPercent = q.number ? Math.round((q.number / 22) * 100) : Math.round(((this.currentStepIndex) / totalSteps) * 100);

      let contentHtml = "";

      if (q.isConceptCard) {
        contentHtml = this.renderConceptInterstitial(q);
      } else if (q.type === "single") {
        contentHtml = this.renderSingleSelect(q);
      } else if (q.type === "multi") {
        contentHtml = this.renderMultiSelect(q);
      } else if (q.type === "text") {
        contentHtml = this.renderTextInput(q);
      } else if (q.type === "pilot_intent") {
        contentHtml = this.renderPilotIntent(q);
      }

      this.container.innerHTML = `
        <div class="max-w-2xl mx-auto w-full px-4 py-6 md:py-10 animate-step-in flex flex-col min-h-[640px]">
          <!-- Header Progress -->
          <div class="mb-6">
            <div class="flex items-center justify-between text-xs md:text-sm font-medium text-slate-400 mb-2">
              <div class="flex items-center gap-2">
                <span class="text-amber-400 font-semibold tracking-wider uppercase text-xs">${q.section || 'RESEARCH'}</span>
                <span class="text-slate-600">•</span>
                <span class="text-white font-semibold">${qLabel}</span>
              </div>
              <span class="text-slate-400 font-mono">${progressPercent}% completed</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div class="bg-amber-400 h-1.5 rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
            </div>
          </div>

          <!-- Main Question Box -->
          <div class="flex-1 flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-xl">
            <div class="flex-1">
              <!-- Validation Alert Message -->
              <div id="survey-validation-alert" class="${this.validationError ? '' : 'hidden'} mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2.5 animate-step-in">
                <svg class="w-4 h-4 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span id="survey-validation-text">${this.validationError || 'Please answer this question before continuing.'}</span>
              </div>

              ${contentHtml}
            </div>

            <!-- Navigation Actions -->
            <div class="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between gap-4">
              <div>
                ${this.currentStepIndex > 0 ? `
                  <button type="button" id="survey-btn-prev" class="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    Back
                  </button>
                ` : `
                  <span class="text-xs text-slate-500">Question 1 of 22</span>
                `}
              </div>

              <div class="flex items-center gap-3">
                <button type="button" id="survey-btn-next" class="btn-yellow px-7 py-2.5 rounded-xl text-sm flex items-center gap-2 font-bold shadow-lg">
                  ${this.currentStepIndex === totalSteps - 1 ? 'Review & Submit' : (q.isConceptCard ? 'Continue Survey →' : 'Next →')}
                </button>
              </div>
            </div>
          </div>

          <!-- Draft Auto-Save Reminder -->
          <div class="mt-4 flex items-center justify-between text-xs text-slate-500 px-2">
            <span>Your responses are automatically saved in this browser.</span>
            <button type="button" id="survey-btn-reset" class="hover:text-amber-400 underline transition">Restart Survey</button>
          </div>
        </div>
      `;

      this.bindEvents(q);
    }

    renderConceptInterstitial(q) {
      return `
        <div class="py-2 text-left">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full badge-research text-xs font-semibold uppercase tracking-wider mb-4">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            Concept Testing Phase
          </div>
          
          <h2 class="text-2xl md:text-3xl font-extrabold text-white mb-4 tracking-tight">
            Here’s the idea we’re exploring.
          </h2>
          
          <div class="space-y-4 text-slate-300 text-base md:text-lg leading-relaxed bg-slate-950/60 p-6 rounded-2xl border border-slate-800 mb-6">
            <p>
              Imagine a platform that helps you find <span class="text-amber-300 font-semibold">verified people</span> from your college, workplace or residential community who regularly travel a similar route and schedule.
            </p>
            <p>
              Instead of finding a different person every day, you could build a <span class="text-amber-300 font-semibold">recurring commute group</span> with people you trust.
            </p>
          </div>

          <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-sm flex items-start gap-3">
            <svg class="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <strong class="font-semibold text-amber-300">Research Hypothesis Only:</strong>
              Rido is not currently launched. We are testing this concept to see if it solves a real problem before building anything.
            </div>
          </div>
        </div>
      `;
    }

    renderSingleSelect(q) {
      const selectedVal = this.answers[q.id] || "";
      const otherVal = this.answers[q.id + "_other"] || "";

      return `
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-white mb-2 leading-snug">
            ${q.title}
          </h2>
          ${q.subtitle ? `<p class="text-slate-400 text-sm mb-6">${q.subtitle}</p>` : '<div class="h-4"></div>'}

          <div class="space-y-2.5">
            ${q.options.map((opt, idx) => {
              const isSelected = selectedVal === opt;
              const isOther = opt.toLowerCase() === "other";
              const keyNumber = idx + 1 <= 9 ? idx + 1 : '';
              
              return `
                <div class="survey-option-card rounded-2xl p-4 flex items-center justify-between gap-3 ${isSelected ? 'selected' : ''}" data-value="${opt}" data-type="single">
                  <div class="flex items-center gap-3.5 flex-1">
                    <span class="option-key w-7 h-7 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">
                      ${keyNumber || '•'}
                    </span>
                    <span class="text-sm md:text-base font-medium text-slate-100">${opt}</span>
                  </div>
                  <div class="w-5 h-5 rounded-full border ${isSelected ? 'border-amber-400 bg-amber-400 text-black' : 'border-slate-600'} flex items-center justify-center flex-shrink-0">
                    ${isSelected ? '<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                  </div>
                </div>
                ${isOther && isSelected ? `
                  <div class="pl-11 pr-2 pt-1 animate-step-in">
                    <input type="text" id="${q.id}_other_input" value="${otherVal}" placeholder="Please specify your details (required)..." class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" required />
                  </div>
                ` : ''}
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    renderMultiSelect(q) {
      const selectedArr = this.answers[q.id] || [];
      const isMaxReached = selectedArr.length >= (q.maxSelect || 3);
      const otherVal = this.answers[q.id + "_other"] || "";

      return `
        <div>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl md:text-2xl font-bold text-white leading-snug flex-1">
              ${q.title}
            </h2>
          </div>
          <div class="flex items-center justify-between text-xs md:text-sm text-slate-400 mb-6">
            <span>${q.subtitle || `Select up to ${q.maxSelect || 3}`}</span>
            <span class="font-mono ${isMaxReached ? 'text-amber-400 font-bold' : 'text-slate-400'}">
              Selected: ${selectedArr.length}/${q.maxSelect || 3}
            </span>
          </div>

          <div class="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            ${q.options.map((opt, idx) => {
              const isSelected = selectedArr.includes(opt);
              const isDisabled = !isSelected && isMaxReached;
              const isOther = opt.toLowerCase() === "other";

              return `
                <div class="survey-option-card rounded-2xl p-4 flex items-center justify-between gap-3 ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" data-value="${opt}" data-type="multi">
                  <div class="flex items-center gap-3.5 flex-1">
                    <span class="option-key w-7 h-7 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">
                      ${idx + 1}
                    </span>
                    <span class="text-sm md:text-base font-medium text-slate-100">${opt}</span>
                  </div>
                  <div class="w-5 h-5 rounded-md border ${isSelected ? 'border-amber-400 bg-amber-400 text-black' : 'border-slate-600'} flex items-center justify-center flex-shrink-0">
                    ${isSelected ? '<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                  </div>
                </div>
                ${isOther && isSelected ? `
                  <div class="pl-11 pr-2 pt-1 animate-step-in">
                    <input type="text" id="${q.id}_other_input" value="${otherVal}" placeholder="Please specify your details (required)..." class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" required />
                  </div>
                ` : ''}
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    renderTextInput(q) {
      const currentVal = this.answers[q.id] || "";

      return `
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-white mb-2 leading-snug">
            ${q.title}
          </h2>
          ${q.subtitle ? `<p class="text-slate-400 text-sm mb-6">${q.subtitle}</p>` : '<div class="h-4"></div>'}

          <div class="mt-4">
            <textarea
              id="${q.id}_textarea"
              rows="5"
              placeholder="${q.placeholder || 'Please type your response here (required)...'}"
              class="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white text-base focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 leading-relaxed transition"
              required
            >${currentVal}</textarea>
            <div class="flex justify-between items-center text-xs text-slate-500 mt-2">
              <span>This question is required. Please type your response before continuing.</span>
              <span id="char-counter">0 words</span>
            </div>
          </div>
        </div>
      `;
    }

    renderPilotIntent(q) {
      const selectedVal = this.answers[q.id] || "";
      const pilotLead = this.answers.pilot_lead || {};
      const showForm = selectedVal === "Yes" || selectedVal === "Maybe";

      return `
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-white mb-2 leading-snug">
            ${q.title}
          </h2>
          <p class="text-slate-400 text-sm mb-6">${q.subtitle}</p>

          <div class="grid grid-cols-3 gap-3 mb-6">
            ${q.options.map(opt => {
              const isSelected = selectedVal === opt;
              return `
                <div class="survey-option-card rounded-2xl p-4 text-center cursor-pointer ${isSelected ? 'selected' : ''}" data-value="${opt}" data-type="single">
                  <div class="text-base font-bold text-white">${opt}</div>
                </div>
              `;
            }).join('')}
          </div>

          ${showForm ? `
            <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4 animate-step-in">
              <div class="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                Pilot Contact & Route Details (All Fields Required)
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1" for="pilot_name">Your Full Name *</label>
                  <input type="text" id="pilot_name" name="name" autocomplete="name" value="${escHtml(pilotLead.name || '')}" placeholder="e.g. Rahul Sharma" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" required />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1" for="pilot_email">Email Address *</label>
                  <input type="email" id="pilot_email" name="email" autocomplete="email" value="${escHtml(pilotLead.email || '')}" placeholder="name@example.com" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" required />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1" for="pilot_phone">Phone Number (WhatsApp) *</label>
                  <input type="tel" id="pilot_phone" name="tel" autocomplete="tel" value="${escHtml(pilotLead.phone || '')}" placeholder="+91 98765 43210" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" required />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1" for="pilot_current_area">Current Area / Society *</label>
                  <input type="text" id="pilot_current_area" name="address-level2" autocomplete="address-line1" value="${escHtml(pilotLead.current_area || '')}" placeholder="e.g. Sector 62, Noida" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" required />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1" for="pilot_destination">Destination (Campus / Office) *</label>
                  <input type="text" id="pilot_destination" name="destination" autocomplete="street-address" value="${escHtml(pilotLead.destination || '')}" placeholder="e.g. Galgotias University" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" required />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1" for="pilot_time">Usual Commute Departure Time *</label>
                  <input type="text" id="pilot_time" name="commute_time" autocomplete="off" value="${escHtml(pilotLead.usual_commute_time || '')}" placeholder="e.g. 8:15 AM" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" required />
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Days of Travel *</label>
                <div class="flex flex-wrap gap-2" id="pilot_days_container">
                  ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => {
                    let isSelected = false;
                    try {
                      if (Array.isArray(pilotLead.travel_days)) {
                        isSelected = pilotLead.travel_days.includes(d);
                      } else if (typeof pilotLead.travel_days === 'string' && pilotLead.travel_days.includes(d)) {
                        isSelected = true;
                      }
                    } catch(e) {}
                    return `<button type="button" data-day="${d}" class="pilot-day-btn px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${isSelected ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/50 hover:text-amber-400'}">${d}</button>`;
                  }).join('')}
                </div>
                <input type="hidden" id="pilot_days" name="travel_days" value="${escHtml(Array.isArray(pilotLead.travel_days) ? JSON.stringify(pilotLead.travel_days) : (pilotLead.travel_days ? JSON.stringify([pilotLead.travel_days]) : '[]'))}" />
              </div>

              <div class="pt-2">
                <label class="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" id="pilot_consent" name="consent" ${pilotLead.consent_agreed !== false ? 'checked' : ''} class="mt-1 rounded bg-slate-800 border-slate-700 text-amber-400 focus:ring-amber-400 focus:ring-offset-slate-900" required />
                  <span class="text-xs text-slate-400 leading-normal">
                    I agree to be contacted regarding the early research/pilot. *
                  </span>
                </label>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    clearValidationError() {
      this.validationError = "";
      const alertEl = this.container.querySelector("#survey-validation-alert");
      if (alertEl) alertEl.classList.add("hidden");
    }

    showValidationError(msg) {
      this.validationError = msg;
      const alertEl = this.container.querySelector("#survey-validation-alert");
      const textEl = this.container.querySelector("#survey-validation-text");
      if (alertEl && textEl) {
        textEl.innerText = msg;
        alertEl.classList.remove("hidden");
        alertEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    bindEvents(q) {
      // Option cards clicks
      const optionCards = this.container.querySelectorAll(".survey-option-card");
      optionCards.forEach(card => {
        card.addEventListener("click", () => {
          this.clearValidationError();
          const val = card.getAttribute("data-value");
          const type = card.getAttribute("data-type");

          if (type === "single") {
            if (this.autoAdvanceTimer) {
              clearTimeout(this.autoAdvanceTimer);
              this.autoAdvanceTimer = null;
            }

            if (q.type === "pilot_intent" && this.container.querySelector("#pilot_name")) {
              this.answers.pilot_lead = {
                name: this.container.querySelector("#pilot_name")?.value.trim() || "",
                email: this.container.querySelector("#pilot_email")?.value.trim() || "",
                phone: this.container.querySelector("#pilot_phone")?.value.trim() || "",
                current_area: this.container.querySelector("#pilot_current_area")?.value.trim() || "",
                destination: this.container.querySelector("#pilot_destination")?.value.trim() || "",
                usual_commute_time: this.container.querySelector("#pilot_time")?.value.trim() || "",
                travel_days: (() => {
                  const v = this.container.querySelector("#pilot_days")?.value;
                  if (!v) return [];
                  try { return JSON.parse(v); } catch(e) { return [v]; }
                })(),
                consent_agreed: this.container.querySelector("#pilot_consent")?.checked === true
              };
            }

            const prevVal = this.answers[q.id];
            this.answers[q.id] = val;

            // Conditional question cleanup:
            if (q.id === "q11") {
              if (val === "Never" && prevVal !== "Never") {
                delete this.answers.q12;
                delete this.answers.q12_other;
              } else if (val !== "Never" && prevVal === "Never") {
                delete this.answers.q13;
                delete this.answers.q13_other;
              }
            } else if (q.id === "q21" || q.id === "q22" || q.type === "pilot_intent") {
              if (val === "No") {
                delete this.answers.pilot_lead;
              }
            }

            // Cleanup if "Other" deselected
            if (prevVal && prevVal.toLowerCase() === "other" && val.toLowerCase() !== "other") {
              delete this.answers[q.id + "_other"];
            }

            this.saveDraft();
            this.render();

            // Smooth auto-advance only for non-other and non-pilot intent single selects
            if (val.toLowerCase() !== "other" && q.type !== "pilot_intent") {
              this.autoAdvanceTimer = setTimeout(() => {
                this.nextStep();
              }, 280);
            }
          } else if (type === "multi") {
            let current = this.answers[q.id] || [];
            if (current.includes(val)) {
              current = current.filter(x => x !== val);
              if (val.toLowerCase() === "other") {
                delete this.answers[q.id + "_other"];
              }
            } else {
              if (current.length < (q.maxSelect || 3)) {
                current.push(val);
              }
            }
            this.answers[q.id] = current;
            this.saveDraft();
            this.render();
          }
        });
      });

      const autoEvents = ["input", "change", "blur", "focus", "keyup", "paste", "animationstart"];

      // Other text inputs
      if (q.hasOtherText) {
        const otherInput = this.container.querySelector(`#${q.id}_other_input`);
        if (otherInput) {
          const syncOther = () => {
            this.clearValidationError();
            this.answers[q.id + "_other"] = otherInput.value;
            this.saveDraft();
          };
          autoEvents.forEach(evt => otherInput.addEventListener(evt, syncOther));
        }
      }

      // Textarea input
      if (q.type === "text") {
        const textarea = this.container.querySelector(`#${q.id}_textarea`);
        const charCounter = this.container.querySelector("#char-counter");
        if (textarea) {
          const updateCounter = () => {
            const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
            if (charCounter) charCounter.innerText = `${words} words`;
          };
          updateCounter();
          const syncText = () => {
            this.clearValidationError();
            this.answers[q.id] = textarea.value;
            this.saveDraft();
            updateCounter();
          };
          autoEvents.forEach(evt => textarea.addEventListener(evt, syncText));
        }
      }

      // Pilot form fields
      if (q.type === "pilot_intent") {
        const syncPilotFields = () => {
          this.clearValidationError();
          this.answers.pilot_lead = {
            name: this.container.querySelector("#pilot_name")?.value.trim() || "",
            email: this.container.querySelector("#pilot_email")?.value.trim() || "",
            phone: this.container.querySelector("#pilot_phone")?.value.trim() || "",
            current_area: this.container.querySelector("#pilot_current_area")?.value.trim() || "",
            destination: this.container.querySelector("#pilot_destination")?.value.trim() || "",
            usual_commute_time: this.container.querySelector("#pilot_time")?.value.trim() || "",
            travel_days: (() => {
              const val = this.container.querySelector("#pilot_days")?.value;
              if (!val) return [];
              try { return JSON.parse(val); } catch(e) { return [val]; }
            })(),
            consent_agreed: this.container.querySelector("#pilot_consent")?.checked === true
          };
          this.saveDraft();
        };

        const pilotInputs = this.container.querySelectorAll("#pilot_name, #pilot_email, #pilot_phone, #pilot_current_area, #pilot_destination, #pilot_time, #pilot_days, #pilot_consent");
        pilotInputs.forEach(inp => {
          autoEvents.forEach(evt => inp.addEventListener(evt, syncPilotFields));
        });

        const dayBtns = this.container.querySelectorAll('.pilot-day-btn');
        const daysInput = this.container.querySelector('#pilot_days');
        dayBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const day = btn.getAttribute('data-day');
            let currentDays = [];
            try { currentDays = JSON.parse(daysInput.value) || []; } catch(err) {}
            if (!Array.isArray(currentDays)) currentDays = [];
            
            if (currentDays.includes(day)) {
              currentDays = currentDays.filter(d => d !== day);
              btn.classList.remove('bg-amber-400', 'text-slate-950', 'border-amber-400');
              btn.classList.add('bg-slate-900', 'text-slate-300', 'border-slate-700');
            } else {
              currentDays.push(day);
              btn.classList.add('bg-amber-400', 'text-slate-950', 'border-amber-400');
              btn.classList.remove('bg-slate-900', 'text-slate-300', 'border-slate-700');
            }
            daysInput.value = JSON.stringify(currentDays);
            syncPilotFields();
          });
        });
      }

      // Next button
      const nextBtn = this.container.querySelector("#survey-btn-next");
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
          }
          this.nextStep();
        });
      }

      // Prev button
      const prevBtn = this.container.querySelector("#survey-btn-prev");
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
          }
          this.prevStep();
        });
      }

      // Reset button
      const resetBtn = this.container.querySelector("#survey-btn-reset");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
          }
          if (confirm("Restart survey? Your previously entered answers will be reset.")) {
            this.clearDraft();
            this.answers = {};
            this.currentStepIndex = 0;
            this.validationError = "";
            this.render();
          }
        });
      }
    }

    validateCurrent(q) {
      if (q.isConceptCard) return true;

      if (q.type === "single") {
        const val = this.answers[q.id];
        if (!val || typeof val !== "string" || !val.trim()) {
          this.showValidationError("Please select an answer to continue.");
          return false;
        }
        if (val.toLowerCase() === "other") {
          const otherVal = this.answers[q.id + "_other"];
          if (!otherVal || !otherVal.trim()) {
            this.showValidationError("Please specify your details for 'Other' to continue.");
            return false;
          }
        }
      } else if (q.type === "multi") {
        const arr = this.answers[q.id] || [];
        if (!Array.isArray(arr) || arr.length === 0) {
          this.showValidationError(`Please select at least 1 option (up to ${q.maxSelect || 3}) to continue.`);
          return false;
        }
        if (arr.includes("Other")) {
          const otherVal = this.answers[q.id + "_other"];
          if (!otherVal || !otherVal.trim()) {
            this.showValidationError("Please specify your details for 'Other' to continue.");
            return false;
          }
        }
      } else if (q.type === "text") {
        const txt = this.answers[q.id];
        if (!txt || typeof txt !== "string" || !txt.trim()) {
          this.showValidationError("Please enter your response to continue.");
          return false;
        }
      } else if (q.type === "pilot_intent") {
        const intent = this.answers[q.id];
        if (!intent) {
          this.showValidationError("Please select Yes, Maybe, or No to continue.");
          return false;
        }
        if (intent === "Yes" || intent === "Maybe") {
          // Synchronize directly from DOM inputs before validating
          const nameEl = this.container.querySelector("#pilot_name");
          if (nameEl) {
            this.answers.pilot_lead = {
              name: this.container.querySelector("#pilot_name")?.value.trim() || "",
              email: this.container.querySelector("#pilot_email")?.value.trim() || "",
              phone: this.container.querySelector("#pilot_phone")?.value.trim() || "",
              current_area: this.container.querySelector("#pilot_current_area")?.value.trim() || "",
              destination: this.container.querySelector("#pilot_destination")?.value.trim() || "",
              usual_commute_time: this.container.querySelector("#pilot_time")?.value.trim() || "",
              travel_days: (() => {
                const val = this.container.querySelector("#pilot_days")?.value;
                if (!val) return [];
                try { return JSON.parse(val); } catch(e) { return [val]; }
              })(),
              consent_agreed: this.container.querySelector("#pilot_consent")?.checked === true
            };
            this.saveDraft();
          }

          const pl = this.answers.pilot_lead || {};
          if (!pl.name || !pl.name.trim()) {
            this.showValidationError("Please enter your full name.");
            return false;
          }
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!pl.email || !emailRegex.test(pl.email.trim())) {
            this.showValidationError("Please enter a valid email address (e.g. name@example.com).");
            return false;
          }
          const phoneClean = (pl.phone || "").replace(/[^0-9+]/g, "");
          if (!pl.phone || phoneClean.length < 8) {
            this.showValidationError("Please enter a valid phone number (at least 8–10 digits).");
            return false;
          }
          if (!pl.current_area || !pl.current_area.trim()) {
            this.showValidationError("Please enter your current area or society.");
            return false;
          }
          if (!pl.destination || !pl.destination.trim()) {
            this.showValidationError("Please enter your destination (campus or office).");
            return false;
          }
          if (!pl.usual_commute_time || !pl.usual_commute_time.trim()) {
            this.showValidationError("Please enter your usual commute departure time.");
            return false;
          }
          if (!pl.travel_days || (Array.isArray(pl.travel_days) && pl.travel_days.length === 0) || (typeof pl.travel_days === 'string' && !pl.travel_days.trim())) {
            this.showValidationError("Please select your days of travel.");
            return false;
          }
          if (pl.consent_agreed !== true) {
            this.showValidationError("Please agree to be contacted regarding the early research/pilot.");
            return false;
          }
        }
      }

      this.clearValidationError();
      return true;
    }

    nextStep() {
      if (this.autoAdvanceTimer) {
        clearTimeout(this.autoAdvanceTimer);
        this.autoAdvanceTimer = null;
      }

      const activeQuestions = this.getActiveQuestions();
      const currentQ = activeQuestions[this.currentStepIndex];

      if (currentQ && !this.validateCurrent(currentQ)) {
        return;
      }

      this.clearValidationError();
      this.currentStepIndex++;
      this.render();
      this.scrollIntoViewIfNeeded();
    }

    prevStep() {
      if (this.autoAdvanceTimer) {
        clearTimeout(this.autoAdvanceTimer);
        this.autoAdvanceTimer = null;
      }

      if (this.currentStepIndex > 0) {
        this.clearValidationError();
        this.currentStepIndex--;
        this.render();
        this.scrollIntoViewIfNeeded();
      }
    }

    handleKeyboard(e) {
      // Don't intercept if pilot modal is open
      const pilotModal = document.getElementById("pilot-modal-backdrop");
      if (pilotModal && !pilotModal.classList.contains("hidden")) return;

      const activeQuestions = this.getActiveQuestions();

      // If user is on the review screen, Enter triggers submit
      if (this.currentStepIndex >= activeQuestions.length) {
        if (e.key === "Enter") {
          e.preventDefault();
          this.submitFinal();
        }
        return;
      }

      const q = activeQuestions[this.currentStepIndex];
      if (!q) return;

      // Don't intercept if user is typing in an input or textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (e.key === "Enter" && activeEl.tagName === "INPUT" && q.type !== "pilot_intent") {
          e.preventDefault();
          this.nextStep();
        }
        return;
      }

      // Keys 1-9 for choices
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (q.options && q.options[idx]) {
          e.preventDefault();
          const targetOpt = q.options[idx];
          if (q.type === "single" || q.type === "pilot_intent") {
            if (this.autoAdvanceTimer) {
              clearTimeout(this.autoAdvanceTimer);
              this.autoAdvanceTimer = null;
            }
            this.clearValidationError();
            this.answers[q.id] = targetOpt;
            this.saveDraft();
            this.render();
            if (targetOpt.toLowerCase() !== "other" && q.type !== "pilot_intent") {
              this.autoAdvanceTimer = setTimeout(() => this.nextStep(), 280);
            }
          } else if (q.type === "multi") {
            this.clearValidationError();
            let current = this.answers[q.id] || [];
            if (current.includes(targetOpt)) {
              current = current.filter(x => x !== targetOpt);
              if (targetOpt.toLowerCase() === "other") delete this.answers[q.id + "_other"];
            } else if (current.length < (q.maxSelect || 3)) {
              current.push(targetOpt);
            }
            this.answers[q.id] = current;
            this.saveDraft();
            this.render();
          }
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        this.nextStep();
      }
    }

    renderReviewOrSubmit() {
      const activeQuestions = this.getActiveQuestions();
      for (let i = 0; i < activeQuestions.length; i++) {
        const testQ = activeQuestions[i];
        if (!testQ.isConceptCard && !this.validateCurrent(testQ)) {
          this.currentStepIndex = i;
          this.render();
          return;
        }
      }

      const q1Val = this.answers.q1 || "—";
      const q4Val = this.answers.q4 || "—";
      const q8Val = (this.answers.q8 || []).join(", ") || "—";
      const q16Val = this.answers.q16 || "—";
      const pilotInterestVal = (this.answers.q22 && ["Yes", "Maybe", "No"].includes(this.answers.q22)) ? this.answers.q22 : (this.answers.q21 || "—");

      this.container.innerHTML = `
        <div class="max-w-2xl mx-auto w-full px-4 py-8 animate-step-in">
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-xl text-center">
            <div class="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center mx-auto mb-5">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            
            <h2 class="text-2xl md:text-3xl font-extrabold text-white mb-2">
              Ready to submit your feedback?
            </h2>
            <p class="text-slate-400 text-sm md:text-base max-w-lg mx-auto mb-6">
              Thank you for sharing your daily commute experience. All required questions have been completed.
            </p>

            <!-- Quick Answer Summary Card -->
            <div class="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 text-left text-xs space-y-2 mb-6">
              <div class="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider mb-2">Summary of Your Response</div>
              <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Respondent Type:</span> <span class="text-slate-200 font-medium">${q1Val}</span></div>
              <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Primary Commute Mode:</span> <span class="text-slate-200 font-medium">${q4Val}</span></div>
              <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Problems Selected:</span> <span class="text-slate-200 font-medium truncate max-w-[240px]">${q8Val}</span></div>
              <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Concept Usefulness:</span> <span class="text-amber-300 font-medium">${q16Val}</span></div>
              <div class="flex justify-between py-1"><span class="text-slate-400">Pilot Interest:</span> <span class="text-emerald-400 font-bold">${pilotInterestVal}</span></div>
            </div>

            <div id="survey-submit-error" class="hidden mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm text-left"></div>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button type="button" id="survey-btn-review-back" class="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition">
                ← Review Answers
              </button>
              <button type="button" id="survey-btn-final-submit" class="w-full sm:w-auto btn-yellow px-8 py-3 rounded-xl text-base font-bold shadow-xl flex items-center justify-center gap-2">
                Submit Research Responses
              </button>
            </div>
          </div>
        </div>
      `;

      this.container.querySelector("#survey-btn-review-back").addEventListener("click", () => {
        // Return to the last question (Q22) so the user can easily step back and review
        this.currentStepIndex = activeQuestions.length - 1;
        this.render();
        this.scrollIntoViewIfNeeded();
      });

      this.container.querySelector("#survey-btn-final-submit").addEventListener("click", () => {
        this.submitFinal();
      });
    }

    async submitFinal() {
      if (this.isSubmitting) return;

      const activeQuestions = this.getActiveQuestions();
      for (let i = 0; i < activeQuestions.length; i++) {
        const testQ = activeQuestions[i];
        if (!testQ.isConceptCard && !this.validateCurrent(testQ)) {
          this.currentStepIndex = i;
          this.render();
          this.scrollIntoViewIfNeeded();
          return;
        }
      }

      if (!this.sessionId) {
        this.sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      }

      this.isSubmitting = true;
      const submitBtn = this.container.querySelector("#survey-btn-final-submit");
      const errBox = this.container.querySelector("#survey-submit-error");
      if (errBox) errBox.classList.add("hidden");

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("opacity-70", "cursor-not-allowed");
        submitBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Submitting responses...
        `;
      }

      // Map answers to server payload
      const payload = {
        session_id: this.sessionId,
        respondent_type: this.answers.q1 || null,
        respondent_type_other: this.answers.q1_other || null,
        commute_frequency: this.answers.q2 || null,
        commute_duration: this.answers.q3 || null,
        commute_mode: this.answers.q4 || null,
        commute_mode_other: this.answers.q4_other || null,
        commute_spend: this.answers.q5 || null,
        travel_alone: this.answers.q6 || null,
        route_regularity: this.answers.q7 || null,
        commute_problems: this.answers.q8 || [],
        commute_problems_other: this.answers.q8_other || null,
        commute_satisfaction: this.answers.q9 || null,
        biggest_problem_open: this.answers.q10 || null,
        shared_before: this.answers.q11 || null,
        discovery_method: this.answers.q12 || null,
        discovery_method_other: this.answers.q12_other || null,
        non_sharing_reason: this.answers.q13 || null,
        non_sharing_reason_other: this.answers.q13_other || null,
        trusted_sharing_partner: this.answers.q14 || null,
        comfort_factors: this.answers.q15 || [],
        comfort_factors_other: this.answers.q15_other || null,
        concept_usefulness: this.answers.q16 || null,
        valuable_features: this.answers.q17 || null,
        adoption_barriers: this.answers.q18 || [],
        adoption_barriers_other: this.answers.q18_other || null,
        likelihood_to_share: this.answers.q19 || null,
        expected_savings: this.answers.q20 || null,
        pilot_interest: (this.answers.q22 && ["Yes", "Maybe", "No"].includes(this.answers.q22)) ? this.answers.q22 : (this.answers.q21 || null),
        pilot_lead: ((this.answers.q22 === "Yes" || this.answers.q22 === "Maybe" || this.answers.q21 === "Yes" || this.answers.q21 === "Maybe") ? (this.answers.pilot_lead || null) : null),
        change_one_thing: (this.answers.q22 && ["Yes", "Maybe", "No"].includes(this.answers.q22)) ? (this.answers.q21 || null) : (this.answers.q22 || null)
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s network timeout

      try {
        const res = await fetch("/api/survey/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          let errDetail = "Server error (" + res.status + ")";
          try {
            const errJson = await res.json();
            if (errJson.detail) errDetail = errJson.detail;
          } catch (_) {}
          throw new Error(errDetail);
        }

        const data = await res.json();
        if (!data || !data.success) {
          throw new Error(data.message || "Failed to confirm submission in database.");
        }

        this.clearDraft();
        this.renderThankYou(payload.pilot_interest === "Yes" || payload.pilot_interest === "Maybe");
        this.scrollIntoViewIfNeeded();
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("Survey submission error:", err);
        if (errBox) {
          if (err.name === "AbortError") {
            errBox.innerText = "Submission timed out due to slow network. Please check your connection and click Retry.";
          } else {
            errBox.innerText = err.message || "We encountered an issue submitting your response. Please verify your connection and retry.";
          }
          errBox.classList.remove("hidden");
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
          submitBtn.innerText = "Retry Submission";
        }
        this.isSubmitting = false;
      }
    }

    renderThankYou(alreadySignedUpForPilot) {
      this.container.innerHTML = `
        <div class="max-w-xl mx-auto w-full px-4 py-12 animate-step-in text-center">
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-xl">
            <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            </div>

            <h2 class="text-2xl md:text-3xl font-extrabold text-white mb-3">
              Thank you for helping us research this.
            </h2>
            
            <p class="text-slate-300 text-sm md:text-base leading-relaxed mb-8">
              Your response will help us understand how people actually commute before we decide what to build.
            </p>

            ${!alreadySignedUpForPilot ? `
              <div class="p-6 rounded-2xl bg-slate-950 border border-slate-800 mb-8 text-left">
                <div class="text-sm font-bold text-amber-400 mb-1">Want to hear about the early pilot?</div>
                <p class="text-xs text-slate-400 mb-4">
                  We are looking for students, professionals and society residents to test recurring route groups.
                </p>
                <button type="button" onclick="window.RidoPilotModal && window.RidoPilotModal.open()" class="btn-yellow w-full py-2.5 rounded-xl text-sm font-bold">
                  Join Early Pilot →
                </button>
              </div>
            ` : `
              <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs mb-8">
                ✓ You have been added to our pilot review registry. We will contact you when routes in your area are being tested.
              </div>
            `}

            <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="/" class="btn-dark px-6 py-2.5 rounded-xl text-sm font-semibold w-full sm:w-auto inline-block">
                Back to Rido Overview
              </a>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Export globally
  window.RidoSurveyEngine = SurveyApp;
})();
