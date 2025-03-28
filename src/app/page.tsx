"use client";
import { useState, useEffect } from "react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import styled from "styled-components";
import { useRouter } from "next/navigation";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
`;

const Button = styled.button`
  padding: 10px;
  font-size: 14pt;
  margin-top: 10px;
  border-radius: 5px;
  background-color: blue;
  color: white;
  cursor: pointer;

  &:hover {
    background-color: darkblue;
  }
`;

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter(); // Initialize the router

  useEffect(() => {
    // Check if a user is already logged in
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true); // Set loading state during login

    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      if (user) {
        router.push("/game"); // Navigate to chat page
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false); // Reset loading state after login
    }
  };

  const handleLogout = async () => {
    setLoading(true); // Set loading state during logout

    try {
      await signOut(auth);
      setUser(null); // Clear the user state
      router.push("/"); // Navigate back to the login page
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false); // Reset loading state after logout
    }
  };

  return (
    <Container>
      {user ? (
        <Button onClick={handleLogout} disabled={loading}>
          {loading ? "로그아웃 중..." : "로그아웃"}
        </Button>
      ) : (
        <Button onClick={handleGoogleAuth} disabled={loading}>
          {loading ? "로그인 중..." : "구글로 로그인"}
        </Button>
      )}
      {error && <p>{error}</p>}
    </Container>
  );
}
