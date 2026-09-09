import React from "react";
import { Message } from "@/lib/aiService";
import { SmileIcon } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="chat-message flex justify-end">
        <div className="bg-primary text-white rounded-lg p-4 max-w-[80%]">
          <p className="text-sm whitespace-pre-line">{message.content}</p>
        </div>
      </div>
    );
  }
  
  // For AI assistant messages
  return (
    <div className="chat-message flex">
      <div className="flex-shrink-0 mr-3">
        <div className="bg-primary text-white p-2 rounded-full h-8 w-8 flex items-center justify-center">
          <SmileIcon className="h-5 w-5" />
        </div>
      </div>
      <div className="bg-slate-100 rounded-lg p-4 max-w-[80%]">
        {/* Dots fade rather than bounce. Bounce easing reads as dated and
            this indicator appears on every single reply. */}
        {message.isLoading ? (
          <div className="flex space-x-1 items-center p-2">
            <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-pulse" style={{ animationDelay: "0ms" }}></div>
            <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-pulse" style={{ animationDelay: "200ms" }}></div>
            <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-pulse" style={{ animationDelay: "400ms" }}></div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-line space-y-4">
            {message.image && (
              <div className="mb-4">
                <img src={message.image} alt="Medical scan" className="rounded-lg max-w-full h-auto" />
              </div>
            )}
            {parseMessageContent(message.content)}
          </div>
        )}
      </div>
    </div>
  );
}

function parseMessageContent(content: string) {
  // Remove markdown bold markers
  content = content.replace(/\*\*(.*?)\*\*/g, '$1');
  // Handle other markdown formatting if needed
  return content;
}
