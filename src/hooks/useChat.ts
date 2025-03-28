import { useState, useEffect, useCallback } from "react";
import { ref, update, onValue, push } from "firebase/database";
import { db } from "@/lib/firebase";

interface ChatMessage {
  id: string;
  message: string;
}

export const useChat = (roomId: string, userId: string | null) => {
  const [chatMessage, setChatMessage] = useState<string>("");
  const [playerChats, setPlayerChats] = useState<ChatMessage[]>([]);

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!userId || !message.trim()) return;

      const playerRef = ref(db, `rooms/${roomId}/characters/${userId}`);
      update(playerRef, {
        chatMessage: message.trim(),
      });

      setTimeout(() => {
        update(playerRef, { chatMessage: null });
      }, 3000);
    },
    [roomId, userId]
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }
  
    const playersRef = ref(db, `rooms/${roomId}/characters`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const chats = Object.entries(data)
          .map(([id, value]: [string, any]) => ({
            id,
            message: value.chatMessage || "",
          }))
          .filter((chat) => chat.message);

  
        setPlayerChats(chats);
      } else {
        console.log("nope.");
      }
    });
  
    return () => unsubscribe();
  }, [roomId]);

  return {
    chatMessage,
    setChatMessage,
    playerChats,
    sendChatMessage,
  };
};
