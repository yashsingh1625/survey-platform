/**
 * Rido Pilot Signup Modal Handler
 * Ensures all displayed fields are validated, prevents double submission,
 * and maintains genuine research messaging without fake account claims.
 */

(function () {
  class PilotModal {
    constructor() {
      this.modalEl = null;
      this.isSubmitting = false;
      this.init();
    }

    init() {
      if (!document.getElementById("rido-pilot-modal-root")) {
        const root = document.createElement("div");
        root.id = "rido-pilot-modal-root";
        root.innerHTML = `
          <div id="pilot-modal-backdrop" class="fixed inset-0 z-50 hidden bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div id="pilot-modal-card" class="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 md:p-8 relative shadow-2xl animate-step-in my-8">
              <!-- Close Button -->
              <button id="pilot-modal-close" type="button" class="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition" aria-label="Close modal">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>

              <div id="pilot-modal-content">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full badge-research text-xs font-semibold uppercase tracking-wider mb-3">
                  <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                  Early Research Cohort
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">Join the Early Pilot</h3>
                <p class="text-slate-400 text-sm mb-5 leading-relaxed">
                  We're looking for a small group of students, professionals and community members to participate in early research and pilot testing.
                </p>

                <!-- Validation Error Notice -->
                <div id="pm_validation_error" class="hidden mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold"></div>

                <form id="pilot-form" class="space-y-3.5">
                  <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1" for="pm_name">Full Name *</label>
                    <input type="text" id="pm_name" name="name" autocomplete="name" required placeholder="e.g. Priya Sharma" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1" for="pm_email">Email Address *</label>
                      <input type="email" id="pm_email" name="email" autocomplete="email" required placeholder="name@example.com" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1" for="pm_phone">Phone Number (WhatsApp) *</label>
                      <input type="tel" id="pm_phone" name="tel" autocomplete="tel" required placeholder="+91 98765 43210" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1" for="pm_current_area">Current Area / Society *</label>
                      <input type="text" id="pm_current_area" name="address-level2" autocomplete="address-line1" required placeholder="e.g. Sector 62, Noida" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1" for="pm_destination">Destination (Campus / Office) *</label>
                      <input type="text" id="pm_destination" name="destination" autocomplete="street-address" required placeholder="e.g. Galgotias University" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1" for="pm_time">Usual Commute Time *</label>
                      <input type="text" id="pm_time" name="commute_time" autocomplete="off" required placeholder="e.g. 8:15 AM" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1">Days of Travel *</label>
                      <div class="flex flex-wrap gap-2" id="pm_days_container">
                        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => {
                          return `<button type="button" data-day="${d}" class="pm-day-btn px-3 py-2 rounded-xl text-xs font-medium transition-colors border bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/50 hover:text-amber-400">${d}</button>`;
                        }).join('')}
                      </div>
                      <input type="hidden" id="pm_days" name="travel_days" value="[]" />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1" for="pm_type">Which best describes you? *</label>
                    <select id="pm_type" name="respondent_type" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-400 focus:outline-none" required>
                      <option value="College / University student">College / University student</option>
                      <option value="Working professional">Working professional</option>
                      <option value="Resident of a residential community / society">Resident of a residential community / society</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div class="pt-1">
                    <label class="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" id="pm_consent" name="consent" checked class="mt-1 rounded bg-slate-800 border-slate-700 text-amber-400 focus:ring-amber-400 focus:ring-offset-slate-900" required />
                      <span class="text-xs text-slate-400 leading-normal">
                        I agree to be contacted regarding the early research/pilot. *
                      </span>
                    </label>
                  </div>

                  <p class="text-[11px] text-slate-500 italic">
                    Pilot availability will depend on location and research requirements.
                  </p>

                  <div class="pt-2">
                    <button type="submit" id="pm_submit_btn" class="w-full btn-yellow py-3 rounded-xl text-sm font-bold shadow-lg">
                      Submit Pilot Application →
                    </button>
                  </div>
                </form>
              </div>

              <!-- Success State -->
              <div id="pilot-modal-success" class="hidden text-center py-6">
                <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">You're on the pilot list</h3>
                <p class="text-slate-300 text-sm leading-relaxed mb-6">
                  Thank you for volunteering to test our concept. We will reach out if an early test cohort opens along your route.
                </p>
                <button type="button" id="pilot-modal-done" class="btn-dark px-6 py-2.5 rounded-xl text-sm font-medium">
                  Close
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(root);
      }

      this.modalEl = document.getElementById("pilot-modal-backdrop");
      this.bindEvents();
    }

    bindEvents() {
      const closeBtn = document.getElementById("pilot-modal-close");
      const doneBtn = document.getElementById("pilot-modal-done");
      const form = document.getElementById("pilot-form");
      const errBox = document.getElementById("pm_validation_error");

      const closeHandler = () => this.close();
      if (closeBtn) closeBtn.onclick = closeHandler;
      if (doneBtn) doneBtn.onclick = closeHandler;

      if (this.modalEl) {
        this.modalEl.addEventListener("click", (e) => {
          if (e.target === this.modalEl) {
            this.close();
          }
        });
      }

      if (form) {
        const clearErr = () => {
          if (errBox) errBox.classList.add("hidden");
        };
        const autoEvents = ["input", "change", "blur", "focus", "keyup", "paste", "animationstart"];
        const inputs = form.querySelectorAll("input, select");
        inputs.forEach(inp => {
          autoEvents.forEach(evt => inp.addEventListener(evt, clearErr));
        });

        const dayBtns = form.querySelectorAll('.pm-day-btn');
        const daysInput = form.querySelector('#pm_days');
        dayBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const day = btn.getAttribute('data-day');
            let currentDays = [];
            try { currentDays = JSON.parse(daysInput.value) || []; } catch(e) {}
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
            clearErr();
          });
        });
        form.onsubmit = async (e) => {
          e.preventDefault();
          if (this.isSubmitting) return;

          const name = document.getElementById("pm_name").value.trim();
          const email = document.getElementById("pm_email").value.trim();
          const phone = document.getElementById("pm_phone").value.trim();
          const current_area = document.getElementById("pm_current_area").value.trim();
          const destination = document.getElementById("pm_destination").value.trim();
          const usual_commute_time = document.getElementById("pm_time").value.trim();
          
          let travel_days = [];
          try {
            travel_days = JSON.parse(document.getElementById("pm_days").value);
          } catch(e) {}
          if (!Array.isArray(travel_days)) travel_days = [];

          const respondent_type = document.getElementById("pm_type").value;
          const consent_agreed = document.getElementById("pm_consent").checked;

          const showError = (msg) => {
            if (errBox) {
              errBox.innerText = msg;
              errBox.classList.remove("hidden");
            }
          };

          if (!name) return showError("Please enter your full name.");
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email)) return showError("Please enter a valid email address.");
          const phoneDigits = phone.replace(/[^0-9+]/g, "");
          if (!phone || phoneDigits.length < 8) return showError("Please enter a valid phone number (at least 8–10 digits).");
          if (!current_area) return showError("Please enter your current area or society.");
          if (!destination) return showError("Please enter your destination.");
          if (!usual_commute_time) return showError("Please enter your usual commute departure time.");
          if (!travel_days || travel_days.length === 0) return showError("Please select your travel days.");
          if (!consent_agreed) return showError("Please agree to be contacted regarding the early research/pilot.");

          if (errBox) errBox.classList.add("hidden");

          const submitBtn = document.getElementById("pm_submit_btn");
          this.isSubmitting = true;
          submitBtn.disabled = true;
          submitBtn.innerText = "Submitting application...";

          const payload = {
            name,
            email,
            phone,
            current_area,
            destination,
            usual_commute_time,
            travel_days,
            respondent_type,
            consent_agreed,
            source: "direct_modal"
          };

          try {
            const res = await fetch("/api/pilot/join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Failed");

            document.getElementById("pilot-modal-content").classList.add("hidden");
            document.getElementById("pilot-modal-success").classList.remove("hidden");
          } catch (err) {
            showError("Unable to submit at this moment. Please check your connection and retry.");
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit Pilot Application →";
          } finally {
            this.isSubmitting = false;
          }
        };
      }
    }

    open() {
      if (this.modalEl) {
        document.getElementById("pilot-modal-content").classList.remove("hidden");
        document.getElementById("pilot-modal-success").classList.add("hidden");
        const errBox = document.getElementById("pm_validation_error");
        if (errBox) errBox.classList.add("hidden");
        this.modalEl.classList.remove("hidden");
        document.body.style.overflow = "hidden";
      }
    }

    close() {
      if (this.modalEl) {
        this.modalEl.classList.add("hidden");
        document.body.style.overflow = "";
      }
    }
  }

  window.RidoPilotModal = new PilotModal();
})();
