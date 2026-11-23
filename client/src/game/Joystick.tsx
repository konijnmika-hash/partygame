import { useEffect, useRef, useState } from 'react';
import { virtual, isTouchDevice } from './input';
import { vibrate } from '../audio/sfx';

/** Floating virtual joystick (left) + action buttons (right). Writes into the shared input state. */
export function TouchControls({ a, b, stick = true, force }: { a?: string; b?: string; stick?: boolean; force?: boolean }) {
  const [show] = useState(() => force || isTouchDevice());
  useEffect(() => () => {
    virtual.active = false;
    virtual.x = 0;
    virtual.y = 0;
    virtual.a = false;
    virtual.b = false;
  }, []);
  if (!show) return null;
  return (
    <div className="touch-controls">
      {stick ? <Stick /> : <span />}
      <div className="touch-buttons">
        {b && <ActionButton label={b} which="b" />}
        {a && <ActionButton label={a} which="a" big />}
      </div>
    </div>
  );
}

function Stick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const pid = useRef<number | null>(null);
  const R = 52;
  const update = (cx: number, cy: number) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    virtual.x = Math.abs(dx / R) < 0.12 ? 0 : dx / R;
    virtual.y = Math.abs(dy / R) < 0.12 ? 0 : dy / R;
    virtual.active = true;
    setKnob({ x: dx, y: dy, on: true });
  };
  const end = () => {
    pid.current = null;
    virtual.active = false;
    virtual.x = 0;
    virtual.y = 0;
    setKnob({ x: 0, y: 0, on: false });
  };
  return (
    <div
      ref={base}
      className={`stick ${knob.on ? 'on' : ''}`}
      onPointerDown={(e) => {
        pid.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => pid.current === e.pointerId && update(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Joystick"
    >
      <div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function ActionButton({ label, which, big }: { label: string; which: 'a' | 'b'; big?: boolean }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => {
    virtual[which] = v;
    setDown(v);
    if (v) vibrate(12);
  };
  return (
    <button
      className={`act-btn ${big ? 'big' : ''} ${down ? 'down' : ''} act-${which}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
