/* ==========================================================================
   SectionNavLink — a section anchor that works from any route.
   · On the home page it renders a plain <a href="#section"> so the native
     smooth-scroll / scroll-spy behaviour is untouched.
   · From any other page (/shop, /account, …) it renders a react-router
     <Link to="/#section"> so the visitor is taken to the home page and the
     section is scrolled into view once it renders.
   ========================================================================== */
import { Link, useLocation } from 'react-router-dom'

export default function SectionNavLink({ href, children, ...rest }) {
  const { pathname } = useLocation()
  if (pathname === '/') {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link to={`/${href}`} {...rest}>
      {children}
    </Link>
  )
}
