import { Message } from "@/lib/aiService";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground">
          <p className="whitespace-pre-line text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
        {message.isLoading ? (
          <div className="flex items-center space-x-1 p-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse" />
            <div
              className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse"
              style={{ animationDelay: "200ms" }}
            />
            <div
              className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse"
              style={{ animationDelay: "400ms" }}
            />
          </div>
        ) : (
          <p className="whitespace-pre-line text-sm">{message.content}</p>
        )}
      </div>
    </div>
  );
}
