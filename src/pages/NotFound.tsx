import eandLogo from "@/assets/eand.png";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] px-6">
      <div className="flex flex-col items-center text-center">
        <img src={eandLogo} alt="e&" className="h-10 w-auto mb-6" />
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
          Access restricted
        </h1>
        <p className="mt-2 text-sm text-white/60">Field One . AI Portal</p>
        <div className="mt-6 h-px w-24 bg-white/15" />
        <p className="mt-6 text-[11px] uppercase tracking-wider text-white/35">
          Authorised access only
        </p>
      </div>
    </div>
  );
}
