import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-bold mb-4">Your admission journey, made simple</h1>
      <p className="text-lg text-gray-600 max-w-xl mx-auto mb-8">
        Build your profile, discover the best universities, medical colleges and academies for you,
        and apply and track everything in one place.
      </p>
      <Link to="/login" className="bg-indigo-700 text-white px-6 py-3 rounded-lg">Get started</Link>
    </div>
  );
}