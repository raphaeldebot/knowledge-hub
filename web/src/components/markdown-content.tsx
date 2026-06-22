import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: label }) => {
            const external = href?.startsWith("http");
            return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>{label}</a>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
