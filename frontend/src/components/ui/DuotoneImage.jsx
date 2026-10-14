/** Any photo, shown in its natural colour (see .duotone in styles/effects.css). */
export default function DuotoneImage({ src, alt = "", className = "", imgClassName = "", ...rest }) {
  return (
    <div className={`duotone ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" draggable="false" className={`size-full object-cover ${imgClassName}`} {...rest} />
    </div>
  );
}
