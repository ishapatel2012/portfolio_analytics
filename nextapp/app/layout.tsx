import "./components/styles/layout.css";

//@ts-ignore
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
