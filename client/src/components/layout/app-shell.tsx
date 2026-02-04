/* ================================
  TL;DR  -->  basic standardized UI layout of the page

      - imports stencil components from common to build out basic page UI
================================ */
import React from "react";


export default function AppShell() {
  return (
   <>
   <HeaderRegion />
   <NavRegion />
   <ContentRegion />
   <FooterRegion />
   </>
  )
}