import { PageEffects } from '@/components/PageEffects';
import { Amenities } from '@/components/sections/Amenities';
import { Booking } from '@/components/sections/Booking';
import { Contact } from '@/components/sections/Contact';
import { Cta } from '@/components/sections/Cta';
import { Explore } from '@/components/sections/Explore';
import { Gallery } from '@/components/sections/Gallery';
import { Hero } from '@/components/sections/Hero';
import { Rooms } from '@/components/sections/Rooms';
import { Statement } from '@/components/sections/Statement';
import { Villa3D } from '@/components/sections/Villa3D';
import { Welcome } from '@/components/sections/Welcome';
import { getRooms } from '@/lib/site';

export default async function Home() {
  const rooms = await getRooms();
  return (
    <>
      <Hero />
      <Welcome />
      <Rooms rooms={rooms} />
      <Villa3D />
      <Explore />
      <Amenities />
      <Statement />
      <Gallery limit={12} />
      <Booking />
      <Contact />
      <Cta />
      <PageEffects />
    </>
  );
}
