import Markdown, { defaultUrlTransform } from 'react-markdown';
import { appUrl } from '../lib/api';

export function MarkdownText({
  text,
  format = 'text',
}: {
  text: string;
  format?: 'text' | 'markdown';
}) {
  return (
    <div className="biography-markdown">
      {format === 'text' ? (
        <div className="biography-plain">{text}</div>
      ) : (
        <Markdown
          skipHtml
          urlTransform={(url) => defaultUrlTransform(url.startsWith('/api/') ? appUrl(url) : url)}
          components={{
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            img: ({ src, alt }) => (
              <img src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" />
            ),
          }}
        >
          {text}
        </Markdown>
      )}
    </div>
  );
}
