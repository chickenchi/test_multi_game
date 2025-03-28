"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, set, get, onValue, update } from "firebase/database";
import styled from "styled-components";

const GameContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-end;
`;

const Character = styled.div`
  position: absolute;
  background-color: #f87171;
  width: 60px;
  height: 80px;
`;

const Ground = styled.div`
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 50px;
  background-color: #8b4513; // 땅 색상
`;

const NicknameDisplay = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  color: white;
  font-size: 1.25rem;
`;

const Game = () => {
  const router = useRouter();
  const [character, setCharacter] = useState({
    x: 100,
    y: 50, // 바닥 위 초기 위치
    vy: 0, // 속도 (y 방향)
    isJumping: false,
  });
  const [nickname, setNickname] = useState<string | null>(null);
  const [keys, setKeys] = useState({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
  });

  const gravity = 0.5; // 중력 값
  const jumpForce = 12; // 점프 시 힘
  const moveSpeed = 5; // 좌우 이동 속도

  const groundY = 50; // 바닥 높이

  // 로그인 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/"); // 로그인 안 되어 있으면 루트로 이동
      } else {
        const userRef = ref(db, `characters/${user.uid}`);

        const userSnap = await get(userRef);

        if (userSnap.exists()) {
          const data = userSnap.val();

          // Firebase에서 가져온 값이 유효한 경우 상태 업데이트
          if (
            typeof data.x === "number" &&
            typeof data.y === "number" &&
            typeof data.vy === "number" &&
            typeof data.isJumping === "boolean"
          ) {
            setCharacter(data);
          }
        } else {
          // Firebase에 데이터가 없을 경우 새로 추가
          const newCharacter = {
            x: 100,
            y: 50,
            vy: 0,
            isJumping: false,
            nickname: user.displayName || "Anonymous",
          };

          console.log([
            "Realtime DB에 캐릭터 데이터 없음. 새로 저장:",
            newCharacter,
          ]);

          await set(userRef, newCharacter);
          setCharacter(newCharacter);
          setNickname(newCharacter.nickname);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 키보드 입력 처리 (방향키, 점프)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        setKeys((prev) => ({ ...prev, [e.key]: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        setKeys((prev) => ({ ...prev, [e.key]: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 캐릭터 움직임 처리
  useEffect(() => {
    const moveInterval = setInterval(() => {
      setCharacter((prev) => {
        let newX = prev.x;
        let newVy = prev.vy;
        let newJumping = prev.isJumping;

        if (keys.ArrowLeft) newX -= moveSpeed;
        if (keys.ArrowRight) newX += moveSpeed;
        if (keys.ArrowUp && !prev.isJumping) {
          newVy = jumpForce;
          newJumping = true;
        }

        // Firebase에 상태 업데이트
        const userRef = ref(db, `characters/${auth.currentUser?.uid}`);
        update(userRef, { x: newX, vy: newVy, isJumping: newJumping });

        return { ...prev, x: newX, vy: newVy, isJumping: newJumping };
      });
    }, 16); // 약 60fps

    return () => clearInterval(moveInterval);
  }, [keys]);

  // 중력 및 바닥 충돌 처리
  useEffect(() => {
    const interval = setInterval(() => {
      setCharacter((prev) => {
        let newY = prev.y + prev.vy;
        let newVy = prev.vy - gravity; // 중력 적용

        // 바닥에 충돌 시 처리
        if (newY <= groundY) {
          newY = groundY;
          newVy = 0;
          return { ...prev, y: newY, vy: newVy, isJumping: false };
        }

        return { ...prev, y: newY, vy: newVy };
      });
    }, 16); // 약 60fps

    return () => clearInterval(interval);
  }, []);

  // Firebase에서 실시간 데이터 반영
  useEffect(() => {
    const userRef = ref(db, `characters/${auth.currentUser?.uid}`);

    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // 상태가 변경되면 업데이트
        setCharacter((prev) => ({
          ...prev,
          x: data.x,
          y: data.y,
          vy: data.vy,
          isJumping: data.isJumping,
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <GameContainer>
      <Ground />
      <Character style={{ left: character.x, bottom: character.y }} />
      <NicknameDisplay>닉네임: {nickname}</NicknameDisplay>
    </GameContainer>
  );
};

export default Game;
