import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ThreeScene from "./components/ThreeScene";
import AboutUs from "./components/AboutUs";
import DepartmentRoom from "./components/DepartmentRoom";
import "./App.css";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ThreeScene />} />
        <Route path="/about-us" element={<AboutUs />} />
        {/* Department rooms — must come after more-specific routes */}
        <Route path="/:deptPath" element={<DepartmentRoom />} />
      </Routes>
    </Router>
  );
};

export default App;
