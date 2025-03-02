import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import styles from "../styles/GlobalMenu.module.css";
import logoImage from "../pages/images/logo.png";

export default function GlobalMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Image src={logoImage} alt="Logo" width={50} height={50} priority />
      </div>

      {/* Hamburger Menu */}
      <div className={styles.burger} onClick={toggleMenu}>
        <div className={`${styles.burgerLine} ${isOpen ? styles.open : ""}`}></div>
        <div className={`${styles.burgerLine} ${isOpen ? styles.open : ""}`}></div>
        <div className={`${styles.burgerLine} ${isOpen ? styles.open : ""}`}></div>
      </div>

      {/* Navigation Links */}
      <ul className={`${styles.navLinks} ${isOpen ? styles.navActive : ""}`}>
        <li><Link href="/" onClick={() => setIsOpen(false)}>Home</Link></li>
        <li><Link href="/mint" onClick={() => setIsOpen(false)}>Mint</Link></li>
        <li><Link href="/collection" onClick={() => setIsOpen(false)}>Collection</Link></li>
        <li><Link href="/edit" onClick={() => setIsOpen(false)}>My Hobos</Link></li>
      </ul>

      {/* Wallet Button */}
      <div className={styles.wallet}>
        <ConnectButton
          showBalance={false}
          chainStatus="none"
          accountStatus={{
            smallScreen: "avatar",
            largeScreen: "full",
          }}
        />
      </div>
    </nav>
  );
}
