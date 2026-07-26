import Link from "next/link";

export default function HomePage() {
  return (
    <main className="bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        {/*
          Fondo institucional: colocar los archivos reales en /public
          (hero.mp4 + hero-poster.jpg). Si no existen, el video simplemente
          no se muestra y queda el degradé oscuro de fondo.
        */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          poster="/hero-poster.jpg"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)]" />

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
            Estudio fotográfico profesional
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Capturamos los momentos que importan
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-zinc-300 sm:text-lg">
            Fotografía de eventos, retratos y producción audiovisual con una
            mirada cuidada y profesional.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/eventos"
              className="rounded-full bg-amber-400 px-8 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:scale-105 hover:bg-amber-300"
            >
              Ver eventos
            </Link>
            <a
              href="#quienes-somos"
              className="text-sm font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline"
            >
              Conocé más sobre nosotros
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-bounce text-zinc-500">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              d="M12 4v16m0 0-6-6m6 6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </section>

      {/* Quiénes somos */}
      <section
        id="quienes-somos"
        className="border-t border-zinc-800 bg-zinc-950 px-4 py-16 sm:px-10 sm:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-400">
              Quiénes somos
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Un equipo de fotógrafos apasionados por contar historias
            </h2>
            <div className="mt-6 space-y-4 text-zinc-400">
              {/* Texto institucional editable */}
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusion
                DigitalMedia nació de la pasión por capturar momentos únicos e
                irrepetibles. Combinamos técnica, equipo profesional y una
                mirada artística para acompañar cada evento de principio a
                fin.
              </p>
              <p>
                Sed do eiusmod tempor incididunt ut labore et dolore magna
                aliqua. Trabajamos con casamientos, cumpleaños, eventos
                corporativos y producciones audiovisuales, entregando
                resultados de la más alta calidad con tiempos de entrega
                cuidados.
              </p>
            </div>
            <Link
              href="/eventos"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300"
            >
              Ver nuestros eventos
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2">
            {[
              { value: "10+", label: "Años de experiencia" },
              { value: "500+", label: "Eventos cubiertos" },
              { value: "50k+", label: "Fotos entregadas" },
              { value: "100%", label: "Clientes satisfechos" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-center sm:p-6"
              >
                <p className="text-2xl font-bold text-amber-400 sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-4 py-8 text-center text-xs text-zinc-600 sm:px-10">
        © {new Date().getFullYear()} Fusion DigitalMedia. Todos los derechos
        reservados.
      </footer>
    </main>
  );
}
