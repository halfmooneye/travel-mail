import {Inject, Injectable, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';

@Injectable()
export class DeviceService {
  private mediaMatcher: MediaQueryList;
  constructor( @Inject(PLATFORM_ID) private platformId: Object) {
    this.mediaMatcher = isPlatformBrowser(platformId) ? matchMedia(`(max-width: 720px)`) : null;
  }

  isSmallScreen() {

    let _isSmallScreen = false;
    if (isPlatformBrowser(this.platformId) && this.mediaMatcher.matches) {
      _isSmallScreen  = true;
    }
    return _isSmallScreen ;
  }

  getPlatformHeight(): number {
    return isPlatformBrowser(this.platformId) ? window.screen.height : 1000;
  }

  getPlatformWidth(): number {
    return isPlatformBrowser(this.platformId) ? window.innerWidth : 1000;
  }

  getHeightStyle(substractFromResult?: number, isForMobileOnly?: boolean) {
    if (isForMobileOnly && !this.isSmallScreen()) {
      return '0px';
    }
    let height = this.getPlatformHeight() - 79 - 69;
    if (substractFromResult) {
      height = height - substractFromResult;
    }
    console.log(height.toString() + 'px');
    return height.toString() + 'px';
  }

  isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

}
