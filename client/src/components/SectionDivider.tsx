export default function SectionDivider({ fill }: { fill: string }) {
  return (
    <div className="section-divider" aria-hidden="true">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path
          d="M0,30 C150,60 350,0 600,30 C850,60 1050,0 1200,30 L1200,60 L0,60 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
