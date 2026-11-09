import type { Person } from '../types';
import { appUrl } from '../lib/api';
import { initials } from '../lib/format';

export function Avatar({ person, large = false }: { person: Person; large?: boolean }) {
  return (
    <span className={`avatar sex-${person.sex} ${large ? 'avatar-large' : ''}`}>
      {initials(person)}
      {person.photo_url && (
        <img
          src={person.photo_url.startsWith('blob:') ? person.photo_url : `${appUrl(person.photo_url)}${person.photo_url.includes('?') ? '&' : '?'}v=${person.revision}`}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          onLoad={(event) => {
            event.currentTarget.hidden = false;
          }}
        />
      )}
    </span>
  );
}
