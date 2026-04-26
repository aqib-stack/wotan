import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const raw = [
[1,'2026-04-04T14:32:00','Leverkusen vs Bayern','Over 2.5',1.75,40,'W',null],
[2,'2026-04-04T17:05:00','Man City vs Aston Villa','Man City win',1.55,50,'W',null],
[3,'2026-04-04T19:40:00','Real Madrid vs Valencia','Over 2.5',1.70,40,'L',null],
[4,'2026-04-05T15:20:00','Liverpool vs Spurs','BTTS',1.65,35,'W',null],
[5,'2026-04-05T18:30:00','Barcelona vs Sevilla','Barca -1.5',2.10,40,'W',null],
[6,'2026-04-06T21:15:00','Napoli vs Roma','Napoli win',1.80,45,'W',null],
[7,'2026-04-06T22:40:00','Atletico vs Betis','Over 2.5',2.00,50,'W',null],
[8,'2026-04-07T19:45:00','Bayern vs Dortmund','Bayern win',1.60,40,'L',null],
[9,'2026-04-07T21:50:00','PSG vs Marseille','BTTS',1.70,40,'W',null],
[10,'2026-04-08T20:15:00','Arsenal vs Brighton','Arsenal win',1.50,60,'W',null],
[11,'2026-04-08T22:05:00','Juventus vs Lazio','Under 2.5',1.90,50,'L',null],
[12,'2026-04-09T21:00:00','Barcelona vs Villarreal','Barca win',1.45,70,'W',null],
[13,'2026-04-10T20:30:00','Real Madrid vs Girona','Real Madrid win',1.40,80,'L',null],
[14,'2026-04-10T22:45:00','Inter vs Milan','Over 2.5',1.95,40,'L',null],
[15,'2026-04-11T15:15:00','Man Utd vs Chelsea','Chelsea win',2.40,30,'L',null],
[16,'2026-04-11T17:30:00','Elche vs Valencia','Over 1.5',1.35,60,'W',null],
[17,'2026-04-11T19:40:00','Barcelona vs Espanyol','Over 3.5',2.10,50,'W',null],
[18,'2026-04-11T22:00:00','Sevilla vs Atletico Madrid','Atletico win',2.25,50,'L',null],
[19,'2026-04-12T15:05:00','Mallorca vs Rayo Vallecano','Mallorca win',1.85,40,'W',null],
[20,'2026-04-12T17:15:00','Celta vs Oviedo','Over 2.5',1.90,40,'L',null],
[21,'2026-04-12T19:30:00','Athletic vs Villarreal','Athletic win',2.00,45,'L',null],
[22,'2026-04-12T21:30:00','Everton vs Liverpool','Liverpool win',1.75,50,'L',null],
[23,'2026-04-12T22:14:00','Man City vs Arsenal','Arsenal +0.5',2.50,120,'L','tilt'],
[24,'2026-04-12T22:33:00','Aston Villa vs Sunderland','Over 3.5 (live)',2.80,100,'W','tilt'],
[25,'2026-04-12T22:48:00','Forest vs Burnley','Forest -1.5',2.40,150,'L','tilt'],
[26,'2026-04-12T23:01:00','Chelsea vs Man Utd','Draw',3.40,100,'L','tilt'],
[27,'2026-04-12T23:08:00','Tottenham vs Brighton','BTTS (live)',1.60,180,'W','tilt'],
[28,'2026-04-13T20:00:00','Levante vs Getafe','Levante win',2.10,60,'W',null],
[29,'2026-04-13T22:15:00','Monaco vs Lyon','Over 2.5',1.95,50,'L',null],
[30,'2026-04-14T21:00:00','Bayern vs Inter','Bayern win',1.70,50,'W',null],
[31,'2026-04-14T22:50:00','Real Madrid vs Liverpool','Over 2.5',1.80,60,'W',null],
[32,'2026-04-15T21:00:00','PSG vs Barcelona','BTTS',1.55,80,'W',null],
[33,'2026-04-15T22:45:00','Arsenal vs Dortmund','Arsenal -1.0',2.20,50,'L',null],
[34,'2026-04-16T20:00:00','Roma vs Leverkusen','Under 2.5',2.05,40,'L',null],
[35,'2026-04-16T22:00:00','Villarreal vs Rangers','Villarreal win',1.65,50,'W',null],
[36,'2026-04-17T21:00:00','Betis vs Real Madrid','Real Madrid win',1.85,60,'L',null],
[37,'2026-04-17T22:55:00','Lazio vs Fiorentina','Over 2.5',2.00,50,'W',null],
[38,'2026-04-17T23:30:00','Augsburg vs Stuttgart','Stuttgart win',2.30,40,'L',null],
[39,'2026-04-17T01:02:00','Club Brugge vs Genk','Over 2.5',2.10,80,'L','tilt'],
[40,'2026-04-17T01:18:00','Sporting vs Benfica','Benfica +0.5',1.90,100,'L','tilt'],
[41,'2026-04-17T01:30:00','Porto vs Braga','Porto win',1.70,120,'W','tilt'],
[42,'2026-04-17T01:42:00','Boca vs River','Under 2.5',2.15,90,'L','tilt'],
[43,'2026-04-18T17:00:00','Newcastle vs Bournemouth','Over 2.5',1.75,45,'W',null],
[44,'2026-04-18T19:30:00','Spurs vs Brighton','BTTS',1.55,50,'W',null],
[45,'2026-04-18T22:00:00','Chelsea vs Man Utd','Man Utd +0.5',2.00,40,'W',null],
[46,'2026-04-19T16:00:00','Everton vs Liverpool','Liverpool win',1.70,50,'W',null],
[47,'2026-04-19T18:30:00','Man City vs Arsenal','Under 3.5',1.80,45,'W',null],
[48,'2026-04-19T21:45:00','Juventus vs Atalanta','BTTS',1.75,40,'L',null],
[49,'2026-04-20T20:00:00','Leipzig vs Hoffenheim','Leipzig win',1.60,50,'W',null],
[50,'2026-04-20T22:00:00','Crystal Palace vs West Ham','Under 2.5',1.85,45,'L',null]
] as const;

async function main() {
  await prisma.bet.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({ data: { name: 'Sample User' } });
  await prisma.bookmakerConnection.create({ data: { userId: user.id, platform: 'Stake', tokenHash: 'demo-token-hash' } });
  await prisma.bet.createMany({
    data: raw.map(([n, placedAt, match, market, odds, stake, result, flag]) => ({
      userId: user.id, n, placedAt: new Date(placedAt), match, market, odds, stake, result, flag,
    }))
  });
  console.log('Seeded 50 sample bets.');
}
main().finally(() => prisma.$disconnect());
