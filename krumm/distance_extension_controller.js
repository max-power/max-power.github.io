const application = Stimulus.Application.start();

application.register("krumm", class extends Stimulus.Controller {
  static targets = ["originalDistance", "prolongedDistance", "result", "originalDistanceOutput", "prolongedDistanceOutput", "maxProlongedDistance", "maxDeviation", "difference"]

  connect() {
    this.parseUrlParams()
    this.updateResults()
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

    const checker = new DistanceExtensionChecker(originalDistance, prolongedDistance)
    
    this.originalDistanceOutputTarget.textContent  = this.formatResult(checker.originalDistance)
    this.prolongedDistanceOutputTarget.textContent = this.formatResult(checker.prolongedDistance)
    this.maxProlongedDistanceTarget.textContent    = this.formatResult(checker.getMaxProlongedDistance())
    this.maxDeviationTarget.textContent            = this.formatResult(checker.getMaxExtension())
    this.differenceTarget.textContent              = this.formatResult(Math.abs(checker.getDifference())) + " " + (checker.getDifference() > 0 ? "drüber" : "drunter")
    
    this.resultTarget.textContent = checker.isValid() ? 'Nein!' : 'Ja!'
    
    document.body.classList.toggle('krumm', !checker.isValid())
  }
  
  formatResult(number) {
    return number.toFixed(2).concat(' km')
  }
})