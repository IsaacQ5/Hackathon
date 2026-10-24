import { useEffect, useState } from 'react';
import { socket } from '../network/socket';

/** Tracks whether the shared socket is currently connected. */
export function useConnection(): boolean {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    socket.io.on('reconnect_failed', off);
    setConnected(socket.connected);
    return () => {
      socket.off('connect', on);
      socket.off('disconnect', off);
      socket.io.off('reconnect_failed', off);
    };
  }, []);
  return connected;
}
