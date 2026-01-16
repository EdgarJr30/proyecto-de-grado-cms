// import { createContext, useContext, useState } from "react";
// import type { ReactNode } from "react";

// interface ITicketNotificationContext {
//   totalTicketsWhenOpened: number;
//   setTotalTicketsWhenOpened: (n: number) => void;
//   newTicketsCount: number;
//   setNewTicketsCount: (n: number) => void;
// }

// const TicketNotificationContext = createContext<ITicketNotificationContext | undefined>(undefined);

// export function TicketNotificationProvider({ children }: { children: ReactNode }) {
//   const [totalTicketsWhenOpened, setTotalTicketsWhenOpened] = useState(0);
//   const [newTicketsCount, setNewTicketsCount] = useState(0);

//   return (
//     <TicketNotificationContext.Provider value={{
//       totalTicketsWhenOpened,
//       setTotalTicketsWhenOpened,
//       newTicketsCount,
//       setNewTicketsCount,
//     }}>
//       {children}
//     </TicketNotificationContext.Provider>
//   );
// }

// // eslint-disable-next-line react-refresh/only-export-components
// export function useTicketNotification() {
//   const ctx = useContext(TicketNotificationContext);
//   if (!ctx) throw new Error("useTicketNotification debe usarse dentro de TicketNotificationProvider");
//   return ctx;
// }
