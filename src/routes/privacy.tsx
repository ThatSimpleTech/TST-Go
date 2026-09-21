import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <main className="min-h-[100dvh] bg-bg px-5 py-10 text-fg">
      <article className="mx-auto max-w-xl leading-relaxed">
        <p className="text-xs tracking-wide text-subtle uppercase">{APP_NAME}</p>
        <h1 className="font-display mt-2 text-3xl font-medium tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: September 21, 2026</p>
        <p className="mt-6 text-sm text-muted">
          TST Go is a location simulator made by That Simple Tech. We do not create accounts,
          run ads, or sell data.
        </p>
        <h2 className="mt-8 text-base font-medium">On this device</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Favorite places stay on your device.</li>
          <li>Location permission is used to show your real pin or to broadcast a simulated GPS signal to other apps after you enable mock location.</li>
          <li>Place search is sent to OpenStreetMap Nominatim and Photon. Map tiles load from Esri.</li>
        </ul>
        <h2 className="mt-8 text-base font-medium">What we do not collect</h2>
        <p className="mt-2 text-sm text-muted">
          No name, email, payment, contacts, photos, advertising ID, analytics, or crash reports.
        </p>
        <h2 className="mt-8 text-base font-medium">Contact</h2>
        <p className="mt-2 text-sm text-muted">
          Questions:{" "}
          <a className="text-accent underline" href="https://github.com/ThatSimpleTech/TST-Go">
            github.com/ThatSimpleTech/TST-Go
          </a>
        </p>
        <p className="mt-8">
          <Link to="/" className="text-sm text-accent underline">
            Back to TST Go
          </Link>
        </p>
      </article>
    </main>
  );
}
