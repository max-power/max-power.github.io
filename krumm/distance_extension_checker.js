class DistanceExtensionChecker {
  constructor(originalDistance, prolongedDistance) {
//    this.originalDistance = Math.ceil(Number(originalDistance));
    this.originalDistance = Number(originalDistance);
    this.prolongedDistance = Number(prolongedDistance);
  }

  isValid() {
    return this.prolongedDistance <= this.getMaxProlongedDistance();
  }

  getDifference() {
    return this.prolongedDistance - this.getMaxProlongedDistance();
  }

  getMaxProlongedDistance() {
    return this.originalDistance + this.getMaxExtension();
  }

  getMaxExtension() {
    if (this.originalDistance < 5.1) {
      return this.getMaxDeviation(1.0, 0.50);
    } else if (this.originalDistance <= 10) {
      return this.getMaxDeviation(2.5, 0.40);
    } else if (this.originalDistance <= 30) {
      return this.getMaxDeviation(4.0, 0.25);
    } else {
      return this.getMaxDeviation(7.5, 0.20);
    }
  }

  getMaxDeviation(km, percent) {
    return Math.max(km, this.originalDistance * percent);
  }
}