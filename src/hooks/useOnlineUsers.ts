import { useEffect, useState } from "react";
import { db } from "@/lib/firebase"; // Firebase 설정 경로
import { ref, set, onValue, remove } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export function useOnlineUsers(roomId: string) {
  const [onlineUsers, setOnlineUsers] = useState<number>(0); // 접속 중인 사용자 수
  const [userId, setUserId] = useState<string | null>(null); // 현재 사용자 ID
  const auth = getAuth();

  // 사용자가 인증되었을 때 userId를 저장
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid); // 인증된 사용자의 ID 설정
      } else {
        setUserId(null); // 인증되지 않으면 null로 설정
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // 사용자 접속 및 퇴장 시 Firebase에 상태 저장
  useEffect(() => {
    if (userId) {
      const userRef = ref(db, `rooms/${roomId}/users/${userId}`);
      
      // 사용자가 접속 중일 때 상태를 true로 설정
      set(userRef, true);
      
      // 사용자가 접속을 종료할 때 해당 사용자 정보를 삭제하는 비동기 작업
      const cleanup = () => {
        remove(userRef); // clean-up 시 비동기 작업
      };
      
      return cleanup; // clean-up 함수로 반환
    }
  }, [userId, roomId]);

  // 접속 중인 사용자 수 실시간 업데이트
  useEffect(() => {
    const usersRef = ref(db, `rooms/${roomId}/users`);
    
    // 비동기 작업을 별도의 비동기 함수로 처리
    const fetchOnlineUsers = () => {
      onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setOnlineUsers(Object.keys(data).length); // 접속 중인 사용자 수 계산
        }
      });
    };

    fetchOnlineUsers(); // 비동기 함수 호출

    return () => {
      // return을 통해 clean-up 처리가 필요하면 여기서 해줄 수 있습니다.
    };
  }, [roomId]);

  return onlineUsers; // 접속 중인 사용자 수 반환
}
