import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const KLIENTI = [
  { jmeno: 'AB-tex pletárna s.r.o.', ico: '29365376', telefon: '420739656183', email: 'bartonek.tom@gmail.com', ulice: 'Vídeňská 260/150', mesto: 'Brno', psc: '61900', poznamka: null },
  { jmeno: 'Acam Solution s.r.o.', ico: '3196364', telefon: null, email: 'pavel.bortlik@acam.cz', ulice: 'Kaštanová 489/34', mesto: 'Brno', psc: '62000', poznamka: null },
  { jmeno: 'Adam Podaný', ico: null, telefon: '420773976133', email: 'adam.podany@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: 'CHECKBOXES: * Rekuperace Klimatizace Poradenství a služby ; * Dobrý den, posílám odkaz půdorysy mého RD. https://www.uschovna.cz/zasilka/POXV9D459VUH8B4M-ZAC/ . mohu poprosit o . mohu poprosit o hrubé nacenění včetně montáže? Pak by mě ještěr zajímalo jaké značky rekuperací dodáváte. A poslední dota' },
  { jmeno: 'Aleš Krč', ico: null, telefon: null, email: 'ales.krc@email.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'ALTREON s.r.o.', ico: '4647572', telefon: null, email: null, ulice: 'Rybná 716/24', mesto: 'Praha', psc: '11000', poznamka: null },
  { jmeno: '[Anonymizovaný záznam]', ico: '61960381', telefon: '999 999 999', email: null, ulice: null, mesto: null, psc: null, poznamka: 'Analýza RD Využití FVE a úvaha nad zdrojem TČ/přímotopu/klimatizace' },
  { jmeno: 'Peter Bajči', ico: null, telefon: '721448693', email: 'peterbajci@seznam.cz', ulice: null, mesto: 'Němčany', psc: null, poznamka: null },
  { jmeno: 'Barbora Páleníková', ico: null, telefon: '776234494', email: 'barbora.palenikova@seznam.cz', ulice: 'Žabí 5', mesto: 'Brno-Žebětín', psc: '641 00', poznamka: 'Kámoška od Toma' },
  { jmeno: 'Adam Bartonec', ico: '4313321', telefon: '737858300', email: 'adam.bartonec@smartforlife.cz', ulice: 'Dětmarovice 1153', mesto: 'Dětmarovice', psc: '73571', poznamka: 'Jan Vincent' },
  { jmeno: 'Tomáš Bartoněk', ico: null, telefon: '420739656183', email: 'bartonek.tom@gmail.com', ulice: 'Staňkova 359/8a', mesto: 'Brno-Královo Pole', psc: '602 00', poznamka: null },
  { jmeno: 'Josef Beneda', ico: '45464073', telefon: '420777880067', email: 'Josef.Beneda@seznam.cz', ulice: 'Lhota 299', mesto: 'Lhota', psc: '76302', poznamka: 'od Vincenta' },
  { jmeno: 'Daniel Bielczyk', ico: '87257246', telefon: null, email: 'daniel@bielczyk.cz', ulice: 'Masarykovo nám. 25/13', mesto: 'Karviná', psc: '73301', poznamka: 'od Ajky' },
  { jmeno: 'Svatoslav Bielczyk', ico: '65501446', telefon: null, email: null, ulice: 'Masarykova třída 914', mesto: 'Orlová', psc: '73514', poznamka: null },
  { jmeno: 'Petr Bílek', ico: null, telefon: '732234335', email: 'petr.bilek@smsfinance.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Pavel Bortlík', ico: null, telefon: '721253572', email: 'pavel.bortlik@acam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Tomáš Buchwaldek', ico: '2154021', telefon: '732122206', email: 'tomas.buchwaldek@gmail.com', ulice: 'Dr. Janského 375/14', mesto: 'Havířov', psc: '73601', poznamka: null },
  { jmeno: 'Dorota Cibulec', ico: '22465961', telefon: '420 732 249 514', email: 'dorota.cibulec@gmail.com', ulice: 'Návsí 628', mesto: 'Návsí', psc: '73992', poznamka: null },
  { jmeno: 'Daniel Cibulka', ico: null, telefon: '732750374', email: 'cibulkad@seznam.cz', ulice: 'Járy Cimrmana  183', mesto: 'Chleby', psc: '289 31', poznamka: null },
  { jmeno: 'Czech Soul s.r.o.', ico: '63488639', telefon: null, email: null, ulice: 'Družstevní 2223/21', mesto: 'Brno', psc: '62100', poznamka: 'Jan Kočař' },
  { jmeno: 'CZ IMMA INVEST s.r.o.', ico: '17280541', telefon: '778564696', email: 'marek@imma.cz', ulice: 'Voctářova 2497/18', mesto: 'Praha', psc: '18000', poznamka: null },
  { jmeno: 'Pavel Čížek', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Nikola Damková', ico: null, telefon: '720 759 876', email: 'ndamkova@seznam.cz', ulice: 'Skřečoňská 1524', mesto: 'Dolní Lutyně', psc: '735 53', poznamka: null },
  { jmeno: 'Daniel Otisk', ico: null, telefon: '731718230', email: 'd.otisk@seznam.cz', ulice: null, mesto: 'Komorní Lhotka', psc: null, poznamka: 'Jan Vincent - kamarád Novostavba RD' },
  { jmeno: 'Daniel Stuchlík', ico: null, telefon: null, email: 'daniel.stuchlik@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'David Víšek', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'DEPRO-STAVBY A INVESTICE CZ a.s.', ico: '21258139', telefon: '603993633', email: 'sarkakocurova@deprostav.cz', ulice: 'Těšnov 1163/5', mesto: 'Praha', psc: '11000', poznamka: null },
  { jmeno: 'Designostav s.r.o.', ico: '6291546', telefon: '777218515', email: 'stracanek@designostav.cz', ulice: 'Francouzská 6167/5', mesto: 'Ostrava', psc: '70800', poznamka: 'Glossl' },
  { jmeno: 'Dušan Mička', ico: null, telefon: '420720935777', email: 'dusan_m@email.cz', ulice: null, mesto: null, psc: null, poznamka: 'CHECKBOXES: * Tepelné čerpadlo Rekuperace ;' },
  { jmeno: 'Edita Kahánková', ico: null, telefon: null, email: 'edita.schlingerova@gmail.com', ulice: 'Závišice 169', mesto: 'Závišice', psc: null, poznamka: null },
  { jmeno: 'Efektivní dům s.r.o.', ico: '27855252', telefon: null, email: 'michal.s@muj-ed.cz', ulice: 'Hlučínská 1177', mesto: 'Ostrava', psc: '70200', poznamka: null },
  { jmeno: 'Eva Julinková', ico: null, telefon: '702888462', email: 'evajulinkova@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Evobeds s.r.o.', ico: '7754523', telefon: '602575747', email: 'trojan@evobeds.com', ulice: 'Paličkova 75/2', mesto: 'Ostrava', psc: '70900', poznamka: null },
  { jmeno: 'Isufi Fikret', ico: null, telefon: '737731023', email: 'keti9675@seznam.cz', ulice: 'Zimmlerova 2999/27', mesto: 'Ostrava-jih', psc: '700 30', poznamka: null },
  { jmeno: 'doc. MUDr. Michal Filip, Ph.D.', ico: null, telefon: '420724665422', email: 'Michal.filip@osu.cz', ulice: 'Proskovická 688/102', mesto: 'Ostrava-jih', psc: '700 30', poznamka: null },
  { jmeno: 'Petra Foltová', ico: null, telefon: '420732193167', email: 'foltova.petra@gmail.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Františkán Petr', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Radek Gajdušek', ico: null, telefon: '604527994', email: 'gajdusek.radek@gmail.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Petr Galčan', ico: null, telefon: null, email: 'petrzovy@yahoo.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Ing. Tomáš Galęziok', ico: '8834911', telefon: null, email: null, ulice: 'Životická 1120/3', mesto: 'Havířov', psc: '73564', poznamka: null },
  { jmeno: 'Sabina Ganiecová', ico: null, telefon: '00420721061040', email: 'sabinag9@seznam.cz', ulice: null, mesto: 'Zerotin', psc: null, poznamka: null },
  { jmeno: 'Lukáš Gavlas', ico: null, telefon: '724 436 599', email: 'galda@seznam.cz', ulice: 'Školní 304', mesto: 'Český Těšín 6', psc: '735 62', poznamka: null },
  { jmeno: 'Safe Group', ico: null, telefon: '704070070', email: 'info@safegroup.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Marcel Hadaš', ico: null, telefon: '420603879097', email: 'had.m@email.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Hana Smigová', ico: null, telefon: null, email: 'hanasmigova@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Lukáš Hanzlík', ico: null, telefon: '420775550770', email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Ing. Josef Hlavsa', ico: '1260219', telefon: null, email: null, ulice: 'Výhledy 566/38b', mesto: 'Ostrava', psc: '72528', poznamka: null },
  { jmeno: 'Daniel Hluchý', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Radek Holbus', ico: null, telefon: '737558952', email: 'holbus.radek@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'Hulbus' },
  { jmeno: 'Ing. Petr Hřib', ico: null, telefon: '737 335 961', email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Hynek Sochor', ico: null, telefon: '420 601 531 298', email: 'hynek.sochor@me.com', ulice: 'Zahradní 294', mesto: 'Bohumín', psc: '735 81', poznamka: null },
  { jmeno: 'Nikola Chovancová', ico: null, telefon: '420725936459', email: 'nikichovancova@seznam.cz', ulice: 'R. Tomáška 425', mesto: 'Studénka 3', psc: '742 13', poznamka: 'Od Syřinka Bydlí na adrese Hasičská 549/48c' },
  { jmeno: 'Ing. Lukáš Egyed', ico: null, telefon: '420777947165', email: 'lukeg@seznam.cz', ulice: 'Karla Pokorného 1554', mesto: 'Ostrava 8', psc: '708 00', poznamka: null },
  { jmeno: 'Ing. Tomáš Kahánek', ico: null, telefon: '420 736 279 359', email: 'tomashudsonkahanek@gmail.com', ulice: 'Pod Bílou horou 1244/11', mesto: 'Kopřivnice', psc: '74221', poznamka: null },
  { jmeno: 'Iveta Zuskarová', ico: null, telefon: '608 888 172', email: 'penzionvpoli@gmail.com', ulice: 'Mexiko 977', mesto: 'Klimkovice', psc: '74285', poznamka: null },
  { jmeno: 'Jakub Slováček', ico: null, telefon: '604749755', email: 'kubaslovacekk75625@gmail.com', ulice: 'Beskydská 88', mesto: 'Nový Jičín 1', psc: '741 01', poznamka: 'Od Toma' },
  { jmeno: 'Slůně-svět jazyků, s.r.o. - Lucie Vlková', ico: null, telefon: '777 758 632', email: 'lucie.vlkova@slune.cz', ulice: null, mesto: null, psc: null, poznamka: 'Z MSIC akce - pacher cold calling - možná bude chtít klimu někdy v budoucnu, ještě se doma nedomluvili...' },
  { jmeno: 'Lukáš Jedelský', ico: null, telefon: '420733315584', email: 'jedelsky.lukas@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'Od Kahyho' },
  { jmeno: 'Jiroutka Marek', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Pavel Jirout', ico: null, telefon: '773926828', email: 'pjpaveljirout@seznam.cz', ulice: 'Na Zvoničce 779', mesto: 'Ostrava 20', psc: '720 00', poznamka: 'Franta Petvaldsky' },
  { jmeno: 'JÍZDÁRENSKÁ a.s.', ico: '25899317', telefon: null, email: 'Stachova@jizdarenska.cz', ulice: 'Na Jízdárně 2767/21a', mesto: 'Ostrava', psc: '70200', poznamka: null },
  { jmeno: 'Josef Chalupa', ico: null, telefon: '420774382761', email: 'chalupajosef43@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'CHECKBOXES: * Rekuperace ; * Prosím o nabidku na kompletni mazerial pro rekuperaci do novostavby, s entalpickym vymenimem, moznosti rizeni jednotlibych casti (ve vsech oknech a dveri budou cidla otevreni) Dum 10.5x11, patrovy, nyni je prostor na realizaci rekuperace, *GDPR Agreement* Seznámil jsem s' },
  { jmeno: 'JOŠISTAV s.r.o.', ico: '28302940', telefon: '601537509', email: 'sevcik@josistav.cz', ulice: 'Žižkova 780/36', mesto: 'Ivanovice na Hané', psc: '68323', poznamka: null },
  { jmeno: 'p. Julinková', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Tomáš Kahánek', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Karel Tlamycha', ico: null, telefon: '420605155662', email: 'karel@tlamycha.cz', ulice: null, mesto: null, psc: null, poznamka: 'CHECKBOXES: * Rekuperace ; * Měl bych zájem o cenovou nabídku na centrální rekuperaci (Zehnder popř. obdobná kvalita) do našeho domu v Prostějově. Jedná se o přízemní řadový domek s garáží a obydleným podkrovím. Jedná se o starší domek, v roce 2010-2012 prošel rekonstrukcí a v obydlených místnostech' },
  { jmeno: 'Karvinská jídelna s.r.o.', ico: '22381660', telefon: '739 671 529', email: 'info@karvinskajidelna.cz', ulice: 'Prameny 823/17', mesto: 'Karviná', psc: '73401', poznamka: null },
  { jmeno: 'Martin Klega', ico: null, telefon: '725174941', email: 'klegamartin@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Ing. arch. Ondřej Klimek', ico: '6721389', telefon: '420775170506', email: 'atelier.klimek@seznam.cz', ulice: 'Podzimní 1251/48', mesto: 'Ostrava', psc: '72100', poznamka: 'Jirka Tománek - sousedi, manželky se znají' },
  { jmeno: 'Dominik Kocián', ico: '9156151', telefon: '420732232315', email: 'dominik.kocian@smsfinance.cz', ulice: 'Nové Dvory-Kamenec 3598', mesto: 'Frýdek-Místek', psc: '73801', poznamka: null },
  { jmeno: 'Milan Kočí', ico: null, telefon: '777 034 034 | WEB', email: 'info@megaframe.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Rostislav Kokotek', ico: '75379201', telefon: '420777323317', email: 'rostik.koki@centrum.cz', ulice: 'Stonavská 1446/28b', mesto: 'Horní Suchá', psc: '73535', poznamka: null },
  { jmeno: 'Jakub Kolář', ico: null, telefon: '723955143', email: 'kolar14@post.cz', ulice: 'K Hájovně 412/2', mesto: 'Kozmice u Hlučína', psc: '747 11', poznamka: 'Od Majky' },
  { jmeno: 'Miroslava Kolářová', ico: null, telefon: null, email: 'kolarova.mirca@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: 'Od Hřiba, sousedi' },
  { jmeno: 'Aleš Krapl', ico: '2037246', telefon: '420 608 252 373', email: 'krapl.ales@gmail.com', ulice: 'Na Parcelaci 2248', mesto: 'Petřvald', psc: '73541', poznamka: null },
  { jmeno: 'Lubomír Krbeček', ico: null, telefon: '721507057', email: 'bobinec@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: 'Kubáň' },
  { jmeno: 'Krevní Centrum F-M', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: 'Rekupka' },
  { jmeno: 'Ladislav Křístek', ico: null, telefon: '602732977', email: 'kristek.l@seznam.cz', ulice: 'Závodí 1913', mesto: 'Frenštát pod Radhoštěm', psc: '744 01', poznamka: null },
  { jmeno: 'Adam Křiva', ico: '3508510', telefon: null, email: null, ulice: 'Kunčičky u Bašky 172', mesto: 'Baška', psc: '73901', poznamka: null },
  { jmeno: 'Ing. Tomáš Kubovský', ico: '6091032', telefon: null, email: 'tomas.kubovsky@inoventive.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Radek Kuncicky', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Stanislav Kunc', ico: null, telefon: '725759839', email: 'stanislav.kunc@kgo.cz', ulice: null, mesto: null, psc: null, poznamka: 'Vincent' },
  { jmeno: 'Radek Kunčický', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Ing. Rostislav Kunčický', ico: null, telefon: null, email: 'rosta.kuncicky@volny.cz', ulice: 'Rodinná 4', mesto: 'Orlová 4', psc: '735 14', poznamka: null },
  { jmeno: 'Martin Lajza', ico: null, telefon: '720033793', email: 'lajza@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: 'Vincent' },
  { jmeno: 'Life Innovation s.r.o.', ico: '24272141', telefon: null, email: null, ulice: 'Kunčičky u Bašky 420', mesto: 'Baška', psc: '73901', poznamka: 'Tom - ze školy' },
  { jmeno: 'Liskovkavet s.r.o.', ico: '4616367', telefon: null, email: null, ulice: 'Nádražní 1097', mesto: 'Frýdek-Místek', psc: '73801', poznamka: null },
  { jmeno: 'Petr Liška', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Lubomír Maléř', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Lukáš Šebek', ico: null, telefon: null, email: null, ulice: '892 Dětmarovice', mesto: 'Dětmarovice', psc: '735 71', poznamka: null },
  { jmeno: 'Ing. Petr Madzia', ico: '76095932', telefon: '731533076', email: null, ulice: 'Pod Zvonek 369', mesto: 'Český Těšín', psc: '73701', poznamka: null },
  { jmeno: 'MAF-OVA s.r.o.', ico: '4073797', telefon: null, email: 'hoppova@mafova.cz', ulice: 'Pohraniční 1591/139', mesto: 'Ostrava', psc: '70300', poznamka: null },
  { jmeno: 'Ing. Jan Macháč', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Darja Makarova', ico: null, telefon: null, email: 'makarovadarija@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Bc. Maroš Mako', ico: null, telefon: '420 739 671 529', email: 'info@karvinskajidelna.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Marek Milata', ico: null, telefon: '420 605 973 454', email: 'Eliska.Milatova@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'martin cuperka', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Milan Martinek', ico: null, telefon: null, email: 'm.martinek@centrum.cz', ulice: null, mesto: null, psc: null, poznamka: 'Vincent' },
  { jmeno: 'Martin Kunčický', ico: null, telefon: null, email: 'martin.kuncicky@gmail.com', ulice: 'Profesora Krbce 8', mesto: 'Tmaň', psc: '26721', poznamka: null },
  { jmeno: 'MATUSA profi s.r.o.', ico: '19999526', telefon: '420605937296', email: 'matusaprofi@gmail.com', ulice: 'Rybná 716/24', mesto: 'Praha', psc: '11000', poznamka: null },
  { jmeno: 'Mgr. et Mgr Petr Pacher PhD., MBA', ico: null, telefon: '725 427 810', email: 'ceo@essentialcollege.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Michal Lolek', ico: null, telefon: '420774842847', email: 'micgal83@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'CHECKBOXES: * Rekuperace ;' },
  { jmeno: 'Milan Žáček', ico: '41362675', telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Marcel Miliček', ico: '2229927', telefon: null, email: null, ulice: 'Vratimovská 662', mesto: 'Václavovice', psc: '73934', poznamka: null },
  { jmeno: 'Miloslav Vrána', ico: null, telefon: '606 316 950', email: 'Mvrana1970@gmail.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Mirek Kocián', ico: null, telefon: '420 732 127 233', email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Miroslav Basel', ico: null, telefon: '420 605 232 474', email: 'yamahadrag@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'p. Miroslav', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: 'Tomův kámoš' },
  { jmeno: 'Miroslav Široký', ico: null, telefon: '420775419794', email: 'm.siroky@centrum.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Madzia ml.', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Vladan Mohelník', ico: null, telefon: '420 773 772 844', email: 'V.Mohelnik@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'MR Design CZ, s.r.o.', ico: '25388606', telefon: '603 418 681', email: 'mira@mrdesign.cz', ulice: 'nábřeží Svazu protifašistických bojovníků 457/30', mesto: 'Ostrava', psc: '70800', poznamka: 'Tyl' },
  { jmeno: 'Mrmont, s.r.o.', ico: '23329319', telefon: null, email: 'michal@mrmont.cz', ulice: 'Vratimovská 624/11', mesto: 'Ostrava', psc: '71800', poznamka: null },
  { jmeno: 'NANTO', ico: null, telefon: '420724347986', email: 'info@nanto.cz', ulice: 'Sokolská třída 1263/24', mesto: 'Moravská Ostrava a Přívoz', psc: '702 00', poznamka: null },
  { jmeno: 'Nastejnelodi.cz, s.r.o.', ico: '4236157', telefon: '420 732 122 206', email: 'tomas.buchwaldek@patriotimsk.cz', ulice: 'Nádražní 416/120', mesto: 'Ostrava', psc: '70200', poznamka: null },
  { jmeno: 'Někdo od Toma', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Radek (neuvedeno)', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'radek@nanto.cz (neuvedeno)', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Bc. Štěpán Neuwirth', ico: '74609262', telefon: '722063848', email: 'xneuwirt@seznam.cz', ulice: 'Dolní Marklovice 70', mesto: 'Petrovice u Karviné', psc: '73572', poznamka: null },
  { jmeno: 'Obec Jeseník nad Odrou', ico: '297976', telefon: '724 180 667', email: 'obec@jeseniknadodrou.cz', ulice: 'Jeseník nad Odrou 256', mesto: 'Jeseník nad Odrou', psc: '74233', poznamka: null },
  { jmeno: 'Ing. Zbyhněv Ocieczek', ico: '16350235', telefon: null, email: 'zbiggi@iol.cz', ulice: 'Majovského 668/35', mesto: 'Ostrava', psc: '71700', poznamka: 'Tom' },
  { jmeno: 'Ondřej Novotný', ico: null, telefon: '792 302 306', email: 'ondrej.novotny.it@gmail.com', ulice: '82', mesto: 'Životice u Nového Jičína', psc: '74272', poznamka: 'Šedý dům s terasou hned za mostem' },
  { jmeno: 'OneHouse s.r.o.', ico: '9819711', telefon: '604 236 174', email: 'petr.f@onehouse.cz', ulice: 'Střádalů 691/57', mesto: 'Ostrava', psc: '71800', poznamka: 'Od KIKI' },
  { jmeno: 'Jakub Palička', ico: '5831733', telefon: '607924141', email: 'palicka@hlidejvodu.cz', ulice: 'Karafiátová 575/5', mesto: 'Opava', psc: '74601', poznamka: null },
  { jmeno: 'PhDr. Michal Panáček PhD.', ico: null, telefon: '777881556', email: 'PanacekMichal@seznam.cz', ulice: 'Lumírova 523/28', mesto: 'Ostrava-jih', psc: '700 30', poznamka: null },
  { jmeno: 'Papřok s.r.o.', ico: '5487625', telefon: '777 774 534', email: 'Radek.Paprok@seznam.cz', ulice: 'Panské Nové Dvory 3731', mesto: 'Frýdek-Místek', psc: '73801', poznamka: null },
  { jmeno: 'Pavel Polášek', ico: null, telefon: '420604918370', email: 'polasek7@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Petr Pětvaldský', ico: null, telefon: '775654552', email: 'petr.petvaldsky@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'Doporučení - Wloďas' },
  { jmeno: 'František Pětvaldský', ico: null, telefon: '605226329', email: 'petvaldskyf@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'Chce TČ + REKUPKU + PODLAHOVÉ TOPENÍ ZEHNDER, Viessmann, tacker systém V rámci vedení VZT schůzka na stavbě ve středu příští týden' },
  { jmeno: 'Ing. Petr Piskorz', ico: '9817450', telefon: '737241174', email: 'petr.piskorz@seznam.cz', ulice: 'Na Stezce 778/2', mesto: 'Havířov', psc: '73601', poznamka: null },
  { jmeno: 'Ing. Jakub Plesník', ico: null, telefon: '420732557319', email: 'jakub.plesnik@gmail.com', ulice: 'Pavlouskova 12', mesto: 'Ostrava 8', psc: '708 00', poznamka: 'CHECKBOXES: ;' },
  { jmeno: 'Lukáš Postulka', ico: '74867113', telefon: '420 775 707 925', email: 'postulka.lukas@prajzbusinessgroup.cz', ulice: 'Lipová 575', mesto: 'Markvartovice', psc: '74714', poznamka: 'Glossl' },
  { jmeno: 'Michaela Postulka', ico: '4801407', telefon: null, email: null, ulice: 'Lipová 575', mesto: 'Markvartovice', psc: '74714', poznamka: null },
  { jmeno: 'PRAJZ Business Group, a.s.', ico: '19960816', telefon: null, email: null, ulice: 'Lipová 575', mesto: 'Markvartovice', psc: '74714', poznamka: null },
  { jmeno: 'PRODOV FACTORY', ico: '19652208', telefon: null, email: null, ulice: 'Ruská 2993/20', mesto: 'Ostrava', psc: '70300', poznamka: null },
  { jmeno: 'Lukáš Prokop', ico: '17740819', telefon: null, email: null, ulice: 'U Soudu 6199/23', mesto: 'Ostrava', psc: '70800', poznamka: null },
  { jmeno: 'Ondřej Prokš', ico: null, telefon: null, email: 'OndraProks@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Marek Przywara', ico: null, telefon: '420792775152', email: 'marek.przywara@seznam.cz', ulice: 'Polní 966', mesto: 'Orlová 4', psc: '735 14', poznamka: null },
  { jmeno: 'p. Wnetrzak', ico: null, telefon: null, email: 'pwnetrzak@gmail.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Radek Kunčický', ico: null, telefon: '724347986', email: 'radek.kuncicky@gmail.com', ulice: 'Rodinná 4', mesto: 'Orlová 4', psc: '735 14', poznamka: null },
  { jmeno: 'Miroslav Rachač', ico: null, telefon: null, email: null, ulice: '634 Sedlnice', mesto: 'Sedlnice', psc: '742 56', poznamka: 'od Gajduška soused' },
  { jmeno: 'Tomáš Rapáček', ico: null, telefon: '720115301', email: 'tomasek.rapacek@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'Kubáň' },
  { jmeno: 'RAYNET s.r.o.', ico: '26843820', telefon: '420 553 401 520', email: 'info@raynet.cz', ulice: 'Hlavní třída 6078/13', mesto: 'Ostrava-Poruba', psc: '708 00', poznamka: 'poskytování software a poradenství v oblasti hardware a software' },
  { jmeno: 'RD Ludgeřovice', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: 'Kahy - Ludheřovice' },
  { jmeno: 'RD Turkovi', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: 'Glosl' },
  { jmeno: 'Rekonstrukce vzduchotechniky ČVUT', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Rekupka, s.r.o.', ico: '19795963', telefon: null, email: 'obchod@rekupka.cz', ulice: 'Pohořská 1102/27', mesto: 'Odry', psc: '74235', poznamka: null },
  { jmeno: 'Vojtěch Režnar', ico: null, telefon: '725787600', email: 'vojtech.reznar@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'RIGHT INDICADA s.r.o.', ico: '4194837', telefon: '732 365 069', email: 'martin.tyser@nastejnelodi.cz', ulice: 'Nádražní 416/120', mesto: 'Ostrava', psc: '70200', poznamka: null },
  { jmeno: 'Rocketas s.r.o.', ico: '21774269', telefon: null, email: null, ulice: 'Příkop 843/4', mesto: 'Brno', psc: '60200', poznamka: null },
  { jmeno: 'Roman Konkol', ico: null, telefon: '775 520 816', email: 'roman.konkol@gmail.com', ulice: 'náměstí Jana Ámose Komenského 12 náměstí J. A. Komenského', mesto: 'Brušperk', psc: '739 44', poznamka: null },
  { jmeno: 'Jana Rosová', ico: null, telefon: null, email: 'jana.rosova87@gmail.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Daniel Russok', ico: '17905796', telefon: null, email: 'danielrussok@seznam.cz', ulice: 'Mizerovská 367/50', mesto: 'Karviná', psc: '73301', poznamka: 'Vincent' },
  { jmeno: 'Ryšek', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Pavel Sedlák', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Martin Seidl', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Marian Schlinger', ico: '67328440', telefon: null, email: null, ulice: 'Kozina 655', mesto: 'Štramberk', psc: '74266', poznamka: null },
  { jmeno: 'Martin Siřinek', ico: '73189995', telefon: '604480012', email: 'martin.sirinek@seznam.cz', ulice: 'Údolní 33', mesto: 'Orlová', psc: '73514', poznamka: null },
  { jmeno: 'Smart stavby s.r.o.', ico: '6418171', telefon: '420734117413', email: 'pavel.vitous@smartstavby.cz', ulice: 'Horní lán 445/1', mesto: 'Olomouc', psc: '78301', poznamka: null },
  { jmeno: 'Petr Socháč', ico: null, telefon: '420737330015', email: 'sochacpetr@seznam.cz', ulice: 'Myslivcova 230/2', mesto: 'Ostrava 21', psc: '721 00', poznamka: 'od Novotneho' },
  { jmeno: 'Hynek Sochor', ico: null, telefon: null, email: null, ulice: 'Zahradní 294', mesto: 'Nový Bohumín', psc: '735 81', poznamka: 'Vincent - doporučení. Prodal tam FVE. Velký klient s Porsche Taycan v garáži' },
  { jmeno: 'Tomáš Sokolínský', ico: null, telefon: '777266241', email: 'sokolinskytom@seznam.cz', ulice: null, mesto: 'Zlín', psc: null, poznamka: 'Vincent - doporuceni' },
  { jmeno: 'Zbyněk Sopuch', ico: '15466647', telefon: null, email: null, ulice: 'Horní Bašta 296', mesto: 'Štramberk', psc: '74266', poznamka: null },
  { jmeno: 'SOTIFO s.r.o.', ico: '17995647', telefon: null, email: 'jan.florko@seznam.cz', ulice: 'Hlavní třída 140/3', mesto: 'Český Těšín', psc: '73701', poznamka: null },
  { jmeno: 'Nanto s.r.o.', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Ondřej Staňkovič', ico: null, telefon: '420735635217', email: 'o.stank@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'STAVEBNÍ SPOLEČNOST ŠURÍK s.r.o.', ico: '27810984', telefon: '420  731 430 714', email: 'bechny@surik.cz', ulice: 'Navrátilova 668/12', mesto: 'Ostrava', psc: '72100', poznamka: 'Stoček' },
  { jmeno: 'STAV KONT development s.r.o.', ico: '6938060', telefon: null, email: null, ulice: 'Pražákova 1008/69', mesto: 'Brno', psc: '63900', poznamka: null },
  { jmeno: 'Marián Střeštík', ico: null, telefon: '774 336 062', email: 'strestik.marian@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Filip Stypka', ico: '7023600', telefon: null, email: null, ulice: 'Hoblíkova 503/26', mesto: 'Nový Jičín', psc: '74101', poznamka: 'Kontakt od Toma Kahánka. Chce stavět dům' },
  { jmeno: 'Filip Sykala', ico: '9801065', telefon: '606 375 759', email: 'sykala@seznam.cz', ulice: 'Příborská 358/22a', mesto: 'Kopřivnice', psc: '74221', poznamka: null },
  { jmeno: 'Daniel Szabo', ico: null, telefon: '778184184', email: 'daniel.szabo@sabtrade.eu', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Stanislav Ševčík', ico: null, telefon: '601 537 509', email: 'sibl@josistav.cz', ulice: null, mesto: null, psc: null, poznamka: 'Od Szotyho' },
  { jmeno: 'Jan Šimurda', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Šmatlava', ico: null, telefon: '732441517', email: null, ulice: null, mesto: null, psc: null, poznamka: 'https://www.gservis.cz/projekty-rodinnych-domu/bologna TČ + možná rekupka' },
  { jmeno: 'Josef Šotkovský', ico: null, telefon: '739176277', email: 'sotkovsky@gmail.com', ulice: 'Na Vyhlídce 2258', mesto: 'Petřvald u Karviné', psc: '735 41', poznamka: 'Vincent' },
  { jmeno: 'p. Švarc', ico: null, telefon: '601590552', email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'TAW, s.r.o.', ico: '60318538', telefon: '420 604 250 624', email: 'vrkocova@taw.cz', ulice: 'Suderova 2013/19a', mesto: 'Ostrava', psc: '70900', poznamka: null },
  { jmeno: 'Těšínská restaurace s.r.o.', ico: '4630751', telefon: '734278323', email: 'Jan.Florko@seznam.cz', ulice: 'Hlavní třída 140/3', mesto: 'Český Těšín', psc: '73701', poznamka: null },
  { jmeno: 'Tomáš Dušek', ico: null, telefon: '420 721 428 051', email: 'tomas.lucie.duskovi@gmail.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Tomáš Chmela', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Tomáš Przywara', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Ing. Stanislav Tomáš', ico: null, telefon: '778887668', email: 'stanislav.tomas@outlook.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'MUDr. Eva Tomaštíková', ico: '49468332', telefon: '420732944729', email: 'Evatomastikova@seznam.cz', ulice: 'K Západi 1995/50', mesto: 'Brno', psc: '62100', poznamka: null },
  { jmeno: 'Tomáš Vítek', ico: null, telefon: '420 739 180 246', email: 'vitektomas1@gmail.com', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Lukáš Topiarz', ico: '70245011', telefon: '732150721', email: 'lukas.topiarz@gmail.com', ulice: 'Stonava 467', mesto: 'Stonava', psc: '73534', poznamka: null },
  { jmeno: 'Abi Totre', ico: '73103438', telefon: '777009003', email: 'info@abitotre.cz', ulice: 'Tyršova 1832/9', mesto: 'Ostrava', psc: '70200', poznamka: null },
  { jmeno: 'TRING INVEST s.r.o.', ico: '26881829', telefon: '731158333', email: 'szromek@tringinvest.cz', ulice: 'Oldřichovice 75', mesto: 'Třinec', psc: '73961', poznamka: null },
  { jmeno: 'Radim Trojan', ico: null, telefon: '602575747', email: 'radim.trojan@email.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Ivan Třeštík', ico: null, telefon: '725886691', email: 'ivantrestik@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: 'Tom Kahánek' },
  { jmeno: 'Václav Fojtík', ico: '63690853', telefon: '737 632 657', email: 'vaclavfojtik@centrum.cz', ulice: 'Ratibořská 97/67', mesto: 'Píšť', psc: '74718', poznamka: null },
  { jmeno: 'Alfred Valošek', ico: null, telefon: '731108065', email: 'alfred.valosek@gmail.com', ulice: '603', mesto: 'Doubrava', psc: '735 33', poznamka: null },
  { jmeno: 'VASED, s.r.o.', ico: '26785897', telefon: '602 577 350', email: 'boss@vased.cz', ulice: 'Souhradská 11/1', mesto: 'Ostrava', psc: '72527', poznamka: null },
  { jmeno: 'Pavel Vašut', ico: '87167930', telefon: '420732275021', email: 'p-vasut@seznam.cz', ulice: 'Oderská 21', mesto: 'Jakubčovice nad Odrou', psc: '74236', poznamka: null },
  { jmeno: 'Velaco4you s.r.o.', ico: '19440031', telefon: '777 889 198', email: 'info@velaco.cz', ulice: 'Na Folimance 2155/15', mesto: 'Praha', psc: '12000', poznamka: null },
  { jmeno: 'Petr Velička', ico: '73810827', telefon: null, email: null, ulice: 'Okružní 1004', mesto: 'Frýdlant nad Ostravicí', psc: '73911', poznamka: null },
  { jmeno: 'Veronika Nowak', ico: null, telefon: null, email: 'veronika@liskovka.com', ulice: 'Lesní 828', mesto: 'Třinec', psc: '73961', poznamka: null },
  { jmeno: 'Filip Veselý', ico: null, telefon: null, email: null, ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Viessmann,spol. s r.o.', ico: '48948365', telefon: null, email: 'Tomas.Seidl@carrier.com', ulice: 'Plzeňská 189', mesto: 'Chrášťany', psc: '25219', poznamka: null },
  { jmeno: 'VIVAVIS Česko s.r.o.', ico: '18051286', telefon: null, email: 'ilona.ceskova@vivavis.cz', ulice: '28. října 1418/125', mesto: 'Ostrava', psc: '70200', poznamka: null },
  { jmeno: 'Vladimír Kaučák', ico: null, telefon: '608647491', email: 'kravcak@seznam.cz', ulice: null, mesto: 'Petřvald', psc: null, poznamka: null },
  { jmeno: 'Václav Vrtělka', ico: null, telefon: '778778800', email: 'vrtelkavaclav@gmail.com', ulice: null, mesto: null, psc: null, poznamka: 'Doporučil Holbus - elektroinstalace od Pavelky' },
  { jmeno: 'p. Vukič', ico: null, telefon: '420739797191', email: 'dani.vuko@gmail.com', ulice: null, mesto: 'Králův Dvůr', psc: null, poznamka: null },
  { jmeno: 'Ing. arch. Stanislav Wilczek', ico: '5176981', telefon: '603304260', email: 'stanislav.wilczek@archwilczek.com', ulice: 'K Rybníku 1231', mesto: 'Orlová', psc: '73514', poznamka: null },
  { jmeno: 'Radana Zajacová', ico: '73053881', telefon: null, email: null, ulice: 'Podkopčí 470', mesto: 'Frenštát pod Radhoštěm', psc: '74401', poznamka: null },
  { jmeno: 'Jan Zajíček', ico: null, telefon: '608 859 524', email: 'dr.zajicek@seznam.cz', ulice: null, mesto: null, psc: null, poznamka: null },
  { jmeno: 'Základní škola a mateřská škola Suchdol nad Odrou, příspěvková organizace', ico: '75027712', telefon: null, email: null, ulice: 'Komenského 323', mesto: 'Suchdol nad Odrou', psc: '74201', poznamka: null },
  { jmeno: 'p. Závacký', ico: null, telefon: '420 725 653 601', email: null, ulice: null, mesto: null, psc: null, poznamka: 'Páté patro. Druhý vchod vedle DDM' },
  { jmeno: 'Jan Zdobinský', ico: null, telefon: '420 603 421 087', email: 'jan.zdobinsky@gmail.com', ulice: 'Nádražní 1624/139', mesto: 'Ostrava', psc: null, poznamka: 'Richard Karas' },
  { jmeno: 'p. Zuskarová', ico: '48785377', telefon: '608888172', email: 'penzionvpoli@gmail.com', ulice: 'Mexiko 977', mesto: 'Klimkovice', psc: '74285', poznamka: 'Jirka Tománek' },
  { jmeno: 'Jiří Žamboch', ico: null, telefon: '00 420 732 750 561', email: null, ulice: null, mesto: null, psc: null, poznamka: null },
]

// Splits "Tomáš Bartoněk" → { jmeno: "Tomáš", prijmeni: "Bartoněk" }
// For companies / single words → { jmeno: fullName, prijmeni: "" }
function splitName(full: string): { jmeno: string; prijmeni: string } {
  const TITLES = ['Ing.', 'Mgr.', 'MUDr.', 'PhDr.', 'Bc.', 'doc.', 'arch.', 'JUDr.', 'RNDr.']
  let s = full.trim()

  // Strip leading titles
  for (const t of TITLES) {
    s = s.replace(new RegExp(`^${t.replace('.', '\\.')}\\s*`, 'i'), '').trim()
  }

  // If it looks like a company (contains s.r.o., a.s., etc.) put everything in jmeno
  if (/s\.r\.o\.|a\.s\.|s\.p\.|spol\.|s\.r\.o|a\.s$/i.test(full) || !s.includes(' ')) {
    return { jmeno: full, prijmeni: '' }
  }

  const parts = s.split(' ')
  return { jmeno: parts[0], prijmeni: parts.slice(1).join(' ') }
}

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'nanto' } })
  if (!org) throw new Error('NANTO org nenalezena!')
  console.log(`✓ Org: ${org.nazev} (${org.id})`)

  let created = 0
  let updated = 0
  let skipped = 0

  // Deduplicate input by jmeno (keep first occurrence only)
  const seen = new Set<string>()
  const unique = KLIENTI.filter(k => {
    const key = k.jmeno.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  for (const k of unique) {
    if (!k.jmeno?.trim()) continue

    // Try to find existing by email first, then by full name match
    const existing = await prisma.client.findFirst({
      where: {
        orgId: org.id,
        OR: [
          ...(k.email ? [{ email: { equals: k.email, mode: 'insensitive' as const } }] : []),
          { AND: [{ jmeno: k.jmeno }, { prijmeni: '' }] },
        ]
      }
    })

    if (existing) {
      const updates: Record<string, string | null> = {}
      if (!existing.telefon && k.telefon) updates.telefon = k.telefon
      if (!existing.email && k.email) updates.email = k.email

      if (Object.keys(updates).length > 0) {
        await prisma.client.update({ where: { id: existing.id }, data: updates })
        console.log(`   ↑ ${k.jmeno} (aktualizován)`)
        updated++
      } else {
        skipped++
      }
      continue
    }

    const { jmeno, prijmeni } = splitName(k.jmeno)

    await prisma.client.create({
      data: {
        orgId: org.id,
        jmeno,
        prijmeni,
        telefon: k.telefon ?? null,
        email: k.email ?? null,
      }
    })
    console.log(`   ✓ ${k.jmeno}`)
    created++
  }

  console.log(`\n✅ Hotovo! Vytvořeno: ${created}, aktualizováno: ${updated}, přeskočeno: ${skipped}`)
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
