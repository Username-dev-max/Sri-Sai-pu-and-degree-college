import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import PublicNav from "../components/home/PublicNav";
import Hero from "../components/home/Hero";
import CollegeIntro from "../components/home/CollegeIntro";
import Programs from "../components/home/Programs";
import CampusShowcase from "../components/home/CampusShowcase";
import DepartmentsStrip from "../components/home/DepartmentsStrip";
import FacultyHighlight from "../components/home/FacultyHighlight";
import WhyChooseUs from "../components/home/WhyChooseUs";
import SportsExcellence from "../components/home/SportsExcellence";
import AchievementsTeaser from "../components/home/AchievementsTeaser";
import Announcements from "../components/home/Announcements";
import GalleryPreview from "../components/home/GalleryPreview";
import AdmissionsCTA from "../components/home/AdmissionsCTA";
import VisionMission from "../components/home/VisionMission";
import Contact from "../components/home/Contact";
import DevelopedBy from "../components/home/DevelopedBy";
import PublicFooter from "../components/home/PublicFooter";
import { ROLE_HOME } from "./Login";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    navigate(ROLE_HOME[user.role] || "/student", { replace: true });
  }, [user, navigate]);

  function load() {
    setError(false);
    client
      .get("/public/overview")
      .then(({ data }) => setData(data))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  if (user) return null;
  if (error) return <ErrorState full message="Couldn't load the homepage. Please check your connection and try again." onRetry={load} />;
  if (!data) return <Loader full label="Loading…" />;

  return (
    <div className="relative">
      <PublicNav collegeName={data.college.name} search={search} onSearch={setSearch} />
      <Hero departments={data.departments} college={data.college} />
      <CollegeIntro stats={data.stats} college={data.college} departments={data.departments} />
      <Programs courses={data.courses} departments={data.departments} search={search} />
      <CampusShowcase />
      <DepartmentsStrip departments={data.departments} />
      <FacultyHighlight faculty={data.faculty} departments={data.departments} />
      <WhyChooseUs />
      <SportsExcellence sportsAchievements={data.sportsAchievements} />
      <AchievementsTeaser academicMerit={data.academicMerit} />
      <Announcements notices={data.notices} exams={data.exams} search={search} />
      <GalleryPreview gallery={data.gallery || []} />
      <AdmissionsCTA courses={data.courses} />
      <VisionMission vision={data.college.vision} mission={data.college.mission} />
      <Contact college={data.college} />
      <DevelopedBy />
      <PublicFooter college={data.college} />
    </div>
  );
}
