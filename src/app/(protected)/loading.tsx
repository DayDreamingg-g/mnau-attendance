// Keep this boundary below the protected layout's session check. A root loading
// boundary would flush a 200 shell before an expired-session redirect is known.
export default function Loading(){return <div className="loading" role="status">Завантаження даних…<div className="skeleton section-space"/></div>;}
