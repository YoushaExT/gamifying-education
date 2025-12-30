import { Link } from "@tanstack/react-router"

import UserMenu from "./UserMenu"

function Navbar() {
  return (
    <div className="hidden md:flex justify-between sticky top-0 items-center bg-secondary w-full p-4 z-50">
      <Link to="/" className="text-xl font-bold">
        Gamifying Education
      </Link>
      <div className="flex gap-2 items-center">
        <UserMenu />
      </div>
    </div>
  )
}

export default Navbar
