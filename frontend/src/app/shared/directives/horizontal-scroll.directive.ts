import { Directive, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';

@Directive({
  selector: '[cvpHorizontalScroll]',
  standalone: true,
  host: { tabindex: '0' }
})
export class HorizontalScrollDirective implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private originScrollLeft = 0;
  private dragging = false;
  private suppressClick = false;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly captureClick = (event: MouseEvent): void => {
    if (!this.suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  ngOnInit(): void {
    this.element.addEventListener('click', this.captureClick, true);
  }

  ngOnDestroy(): void {
    this.element.removeEventListener('click', this.captureClick, true);
    if (this.releaseTimer !== null) clearTimeout(this.releaseTimer);
  }

  @HostListener('pointerdown', ['$event'])
  start(event: PointerEvent): void {
    // Mobile browsers provide momentum scrolling and reliably decide whether a
    // gesture is vertical or horizontal. Handling touch here would replace that
    // native behaviour with one synchronous scrollLeft assignment per move.
    if (event.pointerType === 'touch') return;
    if (!event.isPrimary || event.button !== 0 || this.element.scrollWidth <= this.element.clientWidth) return;
    this.pointerId = event.pointerId;
    this.originX = event.clientX;
    this.originY = event.clientY;
    this.originScrollLeft = this.element.scrollLeft;
    this.dragging = false;
    this.suppressClick = false;
    this.element.setPointerCapture(event.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  move(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const deltaX = this.originX - event.clientX;
    const deltaY = this.originY - event.clientY;
    if (!this.dragging && Math.abs(deltaX) < 6) return;
    if (!this.dragging && Math.abs(deltaY) > Math.abs(deltaX)) return;
    this.dragging = true;
    this.element.classList.add('is-dragging');
    this.element.scrollLeft = this.originScrollLeft + deltaX;
    if (event.cancelable) event.preventDefault();
  }

  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  finish(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    if (this.element.hasPointerCapture(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
    this.pointerId = null;
    if (!this.dragging) return;
    this.suppressClick = true;
    this.releaseTimer = setTimeout(() => {
      this.suppressClick = false;
      this.dragging = false;
      this.element.classList.remove('is-dragging');
      this.releaseTimer = null;
    }, 0);
  }

  @HostListener('keydown', ['$event'])
  useArrowKeys(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    this.element.scrollBy({ left: direction * this.element.clientWidth * .8, behavior: 'smooth' });
  }
}
