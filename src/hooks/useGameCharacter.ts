import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";

// 게임 캐릭터 상태를 관리하는 커스텀 훅
export function useGameCharacter(roomId: string, userId: string) {
  const [character, setCharacter] = useState<{ x: number; y: number; vy: number; isJumping: boolean }>({
    x: 100,
    y: 300,
    vy: 0,
    isJumping: false,
  });

  // Firestore에서 실시간으로 캐릭터 상태를 불러오기
  useEffect(() => {
    const characterRef = ref(db, `rooms/${roomId}/characters/${userId}`);

    const unsubscribe = onValue(characterRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCharacter({
          x: data.x || 100,
          y: data.y || 300,
          vy: data.vy || 0,
          isJumping: data.isJumping || false,
        });
      }
    });

    return () => unsubscribe();
  }, [roomId, userId]);

  const updateCharacter = async (newCharacter: { userId: string | null, x: number; y: number; vy: number; isJumping: boolean, nickname: string | null }) => {
    const characterRef = ref(db, `rooms/${roomId}/characters/${newCharacter.userId}`);
    await update(characterRef, newCharacter);
  };

  return { character, updateCharacter };
}
