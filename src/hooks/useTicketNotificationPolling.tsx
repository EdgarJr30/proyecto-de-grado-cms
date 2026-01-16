// import { useEffect } from "react";
// import { getTotalTicketsCount } from "../services/ticketService";
// // import { useTicketNotification } from "../context/TicketNotificationContext";

// export function useTicketNotificationPolling(pollingIntervalMs = 3600000) {
//   const {
//     totalTicketsWhenOpened,
//     setTotalTicketsWhenOpened,
//     setNewTicketsCount,
//   } = useTicketNotification();

//   // Inicializa el snapshot al montar la app
//   useEffect(() => {
//     async function fetchInitial() {
//       const count = await getTotalTicketsCount();
//       setTotalTicketsWhenOpened(count);
//       setNewTicketsCount(0);
//     }
//     fetchInitial();
//     // eslint-disable-next-line
//   }, []);

//   // Polling para detectar nuevos tickets
//   useEffect(() => {
//     const interval = setInterval(async () => {
//       const count = await getTotalTicketsCount();
//       setNewTicketsCount(Math.max(0, count - totalTicketsWhenOpened));
//       // Si quieres vibración:
//       if (count > totalTicketsWhenOpened && "vibrate" in navigator) {
//         navigator.vibrate([120, 60, 120]);
//       }
//       // Si quieres sonido, descomenta:
//       // if (count > totalTicketsWhenOpened) {
//       //   new Audio('/sounds/notification.mp3').play();
//       // }
//       // Si quieres push, ver docs Web Notifications
//     }, pollingIntervalMs);

//     return () => clearInterval(interval);
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [totalTicketsWhenOpened, setNewTicketsCount]);
// }
