import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import DailyPrediction from './pages/DailyPrediction';
import Day from './pages/Day';
import LevelLibrary from './pages/LevelLibrary';
import LevelDetail from './pages/LevelDetail';
import MarketExamples from './pages/MarketExamples';
import ExampleCategory from './pages/ExampleCategory';
import Archive from './pages/Archive';
import SearchResults from './pages/SearchResults';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/predict" element={<DailyPrediction />} />
        <Route path="/day/:id" element={<Day />} />

        <Route path="/library" element={<LevelLibrary />} />
        <Route path="/library/:id" element={<LevelDetail />} />

        <Route path="/examples" element={<MarketExamples />} />
        <Route path="/examples/:slug" element={<ExampleCategory />} />

        <Route path="/archive" element={<Archive />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
