const application = Stimulus.Application.start();

application.register("krumm", class extends Stimulus.Controller {
  static targets = ["originalDistance", "prolongedDistance", "result", "originalDistanceOutput", "prolongedDistanceOutput", "maxProlongedDistance", "maxDeviation", "difference"]

  connect() {
    this.parseUrlParams()
    this.updateResults()
    this.focusField()
  }
  
  focusField() {
    this.originalDistanceTarget.focus()
    this.originalDistanceTarget.dispatchEvent(new Event('touchstart', { bubbles: true }));
  }
  
  parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('original')) {
      this.originalDistanceTarget.value = urlParams.get('original');
    }
    
    if (urlParams.has('prolonged')) {
      this.prolongedDistanceTarget.value = urlParams.get('prolonged');
    }
  }

  updateResults() {
    const originalDistance  = parseFloat(this.originalDistanceTarget.value)  || 0
    const prolongedDistance = parseFloat(this.prolongedDistanceTarget.value) || 0

    const checker   = new DistanceExtensionChecker(originalDistance, prolongedDistance)
    const formatter = new Intl.NumberFormat('de-DE', {
      style: 'unit',
      unit: 'kilometer',
      unitDisplay: 'short', // Can be 'short', 'long', or 'narrow'
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    });
    
    
    this.originalDistanceOutputTarget.textContent  = formatter.format(checker.originalDistance)
    this.prolongedDistanceOutputTarget.textContent = formatter.format(checker.prolongedDistance)
    this.maxProlongedDistanceTarget.textContent    = formatter.format(checker.getMaxProlongedDistance())
    this.maxDeviationTarget.textContent            = formatter.format(checker.getMaxExtension())
    this.differenceTarget.textContent              = formatter.format(Math.abs(checker.getDifference())) + " " + (checker.getDifference() > 0 ? "drüber" : "drunter")
    
    this.resultTarget.textContent = checker.isValid() ? 'Nein!' : 'Ja!'
    
    document.body.classList.toggle('krumm', !checker.isValid())
  }
})