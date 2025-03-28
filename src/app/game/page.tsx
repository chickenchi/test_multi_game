"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import styled from "styled-components";
import { useGameCharacter } from "@/hooks/useGameCharacter";
import { useChat } from "@/hooks/useChat";
import { get, ref, set, onValue, off, update } from "firebase/database";

const GameContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

const CharacterContainer = styled.div`
  position: absolute;
`;

const CharacterSprite = styled.div`
  width: 60px;
  height: 60px;
  background-color: #f87171;
`;

const CharacterNickname = styled.div`
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  color: white;
  font-size: 14px;
  text-shadow: 1px 1px 2px black;
`;

const Ground = styled.div`
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 50px;
  background-color: #8b4513;
`;

const ChatInput = styled.input`
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  padding: 5px;
  border: none;
  border-radius: 5px;
`;

const ChatBubble = styled.div`
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  background-color: white;
  padding: 5px 10px;
  border-radius: 10px;
  white-space: nowrap;
  font-size: 12px;
`;

interface PlayerState {
  x: number;
  y: number;
  vy: number;
  isJumping: boolean;
  id: string;
  nickname: string;
}

const Game = () => {
  const router = useRouter();
  const [roomId] = useState<string>("defaultRoom");
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [keys, setKeys] = useState({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
  });
  const [otherPlayers, setOtherPlayers] = useState<PlayerState[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { character, updateCharacter } = useGameCharacter(roomId, userId || "");
  const { chatMessage, setChatMessage, playerChats, sendChatMessage } = useChat(
    roomId,
    userId || ""
  );
  const [showChatInput, setShowChatInput] = useState(false);

  const gravity = 0.2;
  const jumpForce = 6;
  const moveSpeed = 3;
  const groundY = 50;
  const frameRate = 1000 / 60;
  const characterWidth = 60;
  const characterHeight = 60;

  const checkCollision = (char1: PlayerState, char2: PlayerState) => {
    return (
      char1.x < char2.x + characterWidth &&
      char1.x + characterWidth > char2.x &&
      char1.y < char2.y + characterHeight &&
      char1.y + characterHeight > char2.y
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      setUserId(user.uid);

      const userRef = ref(db, `rooms/${roomId}/characters/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        console.log(userData);

        // 기존 데이터 유지하면서 필요한 부분만 업데이트
        if (typeof userData.x === "number" && typeof userData.y === "number") {
          setNickname(userData.nickname || user.displayName || "Anonymous");
          updateCharacter(userData);
        }
      } else {
        // 새 캐릭터 정보 생성
        const newCharacter = {
          userId: user.uid,
          x: 100,
          y: 0,
          vy: 0,
          isJumping: false,
          nickname: user.displayName || "Anonymous",
        };

        // 상태 업데이트 후 DB에 저장
        setNickname(newCharacter.nickname);
        await set(userRef, newCharacter);
        updateCharacter(newCharacter);
      }
    });

    return () => unsubscribe();
  }, [roomId, router]); // 의존성 배열 유지

  useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/characters`);
    const playersListener = onValue(playersRef, (snapshot) => {
      const playersData = snapshot.val();
      if (playersData) {
        const playersArray = Object.keys(playersData)
          .map((id) => ({
            id,
            x: playersData[id].x,
            y: playersData[id].y,
            vy: playersData[id].vy,
            isJumping: playersData[id].isJumping,
            nickname: playersData[id].nickname || "Anonymous",
          }))
          .filter((player) => player.id !== userId); // 자신의 캐릭터를 제외

        setOtherPlayers(playersArray);
      }
    });

    return () => {
      off(playersRef, "value", playersListener);
    };
  }, [roomId, userId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        setKeys((prev) => ({ ...prev, [e.key]: true }));
      } else if (e.key === "/" && !showChatInput) {
        e.preventDefault();
        setShowChatInput(true);
      }
    },
    [showChatInput]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
      setKeys((prev) => ({ ...prev, [e.key]: false }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const updateCharacterPosition = useCallback(() => {
    let newX = character.x;
    let newY = character.y;
    let newVy = character.vy;
    let newJumping = character.isJumping;

    if (keys.ArrowLeft) newX -= moveSpeed;
    if (keys.ArrowRight) newX += moveSpeed;
    if (keys.ArrowUp && !character.isJumping) {
      newVy = jumpForce;
      newJumping = true;
    }

    newVy -= gravity;
    newY += newVy;

    // 다른 플레이어와의 충돌 검사
    let standingOnPlayer = false;
    for (const player of otherPlayers) {
      if (player.id !== userId) {
        if (
          checkCollision(
            {
              ...character,
              id: userId || "",
              nickname: nickname || "Anonymous",
            },
            player
          )
        ) {
          if (character.y >= player.y + characterHeight - 5) {
            newY = player.y + characterHeight;
            newVy = 0;
            newJumping = false;
            standingOnPlayer = true;
          }
        }
      }
    }

    // 바닥 충돌 검사 (다른 플레이어 위에 서있지 않을 때만)
    if (!standingOnPlayer && newY <= groundY) {
      newY = groundY;
      newVy = 0;
      newJumping = false;
    }

    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      newX = Math.max(0, Math.min(newX, containerWidth - characterWidth));
    }

    updateCharacter({
      userId: userId,
      nickname: nickname,
      x: newX,
      y: newY,
      vy: newVy,
      isJumping: newJumping,
    });

    if (userId) {
      const playerRef = ref(db, `rooms/${roomId}/characters/${userId}`);
      update(playerRef, {
        userId: userId,
        x: newX,
        y: newY,
        vy: newVy,
        isJumping: newJumping,
        nickname,
      });
    }
  }, [
    character,
    keys,
    updateCharacter,
    userId,
    roomId,
    nickname,
    otherPlayers,
  ]);

  useEffect(() => {
    if (!userId || !character) return;

    let lastTime = 0;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (currentTime - lastTime >= frameRate) {
        updateCharacterPosition();
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [updateCharacterPosition]);

  return (
    <GameContainer ref={containerRef}>
      <Ground />
      <CharacterContainer style={{ left: character.x, bottom: character.y }}>
        <CharacterSprite />
        <CharacterNickname>{nickname}</CharacterNickname>
        {playerChats.find((chat) => chat.id === userId)?.message && (
          <ChatBubble>
            {playerChats.find((chat) => chat.id === userId)?.message}
          </ChatBubble>
        )}
      </CharacterContainer>
      {otherPlayers.map((player) => (
        <CharacterContainer
          key={player.id}
          style={{
            left: player.x,
            bottom: player.y,
          }}
        >
          <CharacterSprite
            style={{
              backgroundColor: player.id === userId ? "#f87171" : "#4CAF50",
            }}
          />
          <CharacterNickname>{player.nickname}</CharacterNickname>
          {playerChats.find((chat) => chat.id === player.id)?.message && (
            <ChatBubble>
              {playerChats.find((chat) => chat.id === player.id)?.message}
            </ChatBubble>
          )}
        </CharacterContainer>
      ))}
      {showChatInput && (
        <ChatInput
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendChatMessage(chatMessage);
              setChatMessage("");
              setShowChatInput(false);
            }
          }}
          onBlur={() => setShowChatInput(false)}
          autoFocus
        />
      )}
    </GameContainer>
  );
};

export default Game;
