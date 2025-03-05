const application = Stimulus.Application.start();

application.register("krumm", class extends Stimulus.Controller {
  static targets = [
    "originalDistance",
    "prolongedDistance",
    "result",
    "originalDistanceOutput",
    "prolongedDistanceOutput",
    "maxProlongedDistance",
    "maxDeviation",
    "difference"
  ];
  
  static SUCCESS_MESSAGE = '😎 Nein!';
  static FAILURE_MESSAGE = '😱 Ja!';

  connect() {
    this.parseUrlParams()
    this.updateResults()
  }
  
  get formatter() {
    if (!this._formatter) {
      this._formatter = new Intl.NumberFormat('de-DE', {
        style: 'unit',
        unit: 'kilometer',
        unitDisplay: 'short',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });
    }
    return this._formatter;
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
    const originalDistance  = Number(this.originalDistanceTarget.value)  || 0
    const prolongedDistance = Number(this.prolongedDistanceTarget.value) || 0

    const checker = new DistanceExtensionChecker(originalDistance, prolongedDistance)

    this.updateUI(checker)
  }
  
  updateUI(checker) {
    document.body.classList.toggle('krumm', !checker.isValid())
    
    this.resultTarget.textContent = checker.isValid()
      ? this.constructor.SUCCESS_MESSAGE
      : this.constructor.FAILURE_MESSAGE;

    this.originalDistanceOutputTarget.textContent  = this.formatValue(checker.originalDistance)
    this.prolongedDistanceOutputTarget.textContent = this.formatValue(checker.prolongedDistance)
    this.maxProlongedDistanceTarget.textContent    = this.formatValue(checker.getMaxProlongedDistance())
    this.maxDeviationTarget.textContent            = this.formatValue(checker.getMaxExtension())
    this.differenceTarget.textContent              = this.formatDifference(checker.getDifference())
  }
  
  formatValue(value) {
    return this.formatter.format(value);
  }
  
  formatDifference(difference) {
    const formattedValue = this.formatValue(Math.abs(difference));
    const label = difference > 0 ? "drüber" : "drunter";
    return `${formattedValue} ${label}`;
  }
})