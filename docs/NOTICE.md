# Уведомление о данных — версия 2 (24.10.2026)

Утверждено владельцем 24.10.2026. Заменяет версию 1 от 23.10.2026: с шага 6а.3 запись журнала уходит на сервер целиком (Р33 п. 8), поэтому список «что храним» назван полностью (сверка полей — план 6а.3, раздел 11). Изменены только шапка и три пункта списка: журнал занятий, настройки («с какого устройства изменены»), устройства («когда устройство последний раз связывалось с сайтом» вместо «даты последнего входа»). Остальной текст — слово в слово как в версии 1. Номер версии `2` пишется в `consents` при каждом согласии; аккаунты с согласием версии 1 дают согласие заново. Любая смена текста — новая версия и повторное согласие (STAGE6_RESEARCH 8.5).

Исправлено до публикации 24.10.2026: «часпондани матн» → «ҷойгузории матн» (решение по глоссарию: «вставить» — ҷойгузорӣ).

Обязательства, которые текст накладывает на код:
- строки `auth_attempts` с хэшем IP стираются не позже чем через сутки (6а.2);
- удаление аккаунта стирает данные сразу, без отложенной очереди (6а.5);
- в `consents`: версия `2`, кто дал согласие (self / parent), имя родителя или опекуна, устройство, время;
- запись журнала уходит на сервер только при согласии версии 2; поле журнала вне категорий списка «что храним» — повод для новой версии текста.

---

## tg

### Додаҳо дар «Моно»
Вироиши 2 · 24.10.2026

«Моно» барномаи шахсӣ ва ғайритиҷории Pooya барои хонавода ва дӯстонаш аст. Тамос: pooyadev@protonmail.com.

Агар ҳисоб дошта бошед, инҳоро нигоҳ медорем:
– таърихчаи тамрин — ҳар ҷавоб як сабт:
  · чиро тамрин кардед: маҷмӯа ва нусхаи он, омӯзбарг ва матни он, маҳорат, ошноӣ ё такрор, кадом тамрин;
  · ҷавоби шумо: матни навишташуда ё шунидашуда, ё бе ҷавоб гузаштед; арзёбии худкор ва далели он; ислоҳи шумо, агар буд; вақти такрори баъдӣ ва чӣ гуна муайян шуд; вақт ва минтақаи замонӣ;
  · равиши ҷавоб: бо гуфтор, бо сафҳакалиди Моно ё сафҳакалиди дастгоҳ, ё бо ҷойгузории матн; муддати замони ҷавобдиҳӣ (бо вақти омода шудани микрофон); чанд бор садоро гӯш додед ва чанд талоши дубора кардед; вақти гузашта ва теъдоди омӯзбаргҳо аз омӯзбарги қаблӣ ва аз такрори қаблии ҳамин омӯзбарг; дубора омадани омӯзбарг дар ҳамон тамрин;
  · омӯзбаргро файли садо хонд ё садои мурургар, ва номи садои мурургар;
  · бозшиносии гуфтор: кадом хидмат, дар худи дастгоҳ ё не, забон ва бастаи забон, мизони итминон, матнҳои дигари шунидашуда ва кадом як интихоб шуд, фарқи гуфтаи шумо аз матни омӯзбарг, қоидаҳои талаффуз, хатоҳо, вожаҳо барои бозшиносии гуфтор ва роҳнамои нишондодашуда;
  · дастгоҳ; тартиби расидани сабтҳо, вақти расидан ва ҳаши ҳар сабт;
– танзимот: забони барнома, забони маъноҳо, теъдоди омӯзбаргҳои нав дар рӯз — ва аз кадом дастгоҳ тағйир додед;
– феҳристи дастгоҳҳои шумо: номи дастгоҳ, охирин боздид, нусхаи барнома;
– сабти ризоят: таърих, вироиши ин матн ва кӣ ризоят додааст; агар яке аз волидайн ё сарпараст ризоят дода бошад — номи ӯ;
– маҷмӯаҳои шахсии шумо — агар онҳоро ба ҳисобатон илова кунед;
– агар вуруд бо код ноком шавад — нишонии IP ба шакли ҳаш (дарҳамсозишуда), то касе натавонад кодро ҳадс бизанад; ҳадди аксар дар зарфи як шабонарӯз пок мешавад.

Имейл, гузарвожа, таърихи таваллуд ва садои шуморо нигоҳ намедорем.

**Барои чӣ ва бар чӣ асосе.** То битавонед дар чанд дастгоҳ тамрин кунед ва пешрафтатон аз даст наравад. Асос — ризояти шумо. Бе ҳисоб барнома танҳо дар ҳамин дастгоҳ кор мекунад ва ҳеҷ додаеро ба мо намефиристад.

**Арзёбии худкор.** Барнома ҷавобро худаш арзёбӣ мекунад, то вақти такрори баъдиро муайян кунад; метавонед арзёбиро ислоҳ кунед. Барнома дар бораи шумо тасмими дигаре намегирад.

**Додаҳоро боз чӣ касоне дарёфт мекунанд:**
– Cloudflare додаҳоро дар Иттиҳоди Аврупо нигоҳ медорад ва ширкати Cloudflare, Inc. (ИМА) тибқи қарордоди пардозиши додаҳо пардозиш мекунад. Интиқол ба ИМА бар асоси тасмими Комисиюни Аврупо дар бораи EU–US Data Privacy Framework аст, ки ҳифзи додаҳоро дар ширкатҳои амрикоии узви ин чорчӯб кофӣ медонад. Мисли ҳар сайти дигар, ҳар бор ки дастгоҳатон ба сайт муроҷиат мекунад, Cloudflare нишонии IP-и онро мебинад.
– Бозшиносии гуфторро мурургар анҷом медиҳад, на «Моно»: Chrome гуфтори шуморо ба Google мефиристад, Edge — ба Microsoft. «Моно» садоро на нигоҳ медорад, на мефиристад.
– Агар омӯзбарг файли садо надошта бошад, онро садои мурургар мехонад; дар Chrome-и компютер ва дар садоҳои «Online»-и Edge ин садо матни омӯзбаргро ба Google ё Microsoft мефиристад.

**То кай нигоҳ медорем.** То вақте ки ҳисоб доред. Пас аз пок кардани ҳисоб додаҳо бедаранг пок мешаванд, аз нусхаҳои пуштибон ҳам — ҳадди аксар дар зарфи 30 рӯз.

**Ҳуқуқҳои шумо.** Метавонед нусхаи додаҳоятонро ба шакли файл гиред, онҳоро ислоҳ кунед, пардозишашонро маҳдуд кунед, ба ҷои дигар баред (файли JSON) ё ҳисобатонро пок кунед. Ҳар вақт метавонед ризоятро пас гиред — ин ба маънои пок кардани ҳисоб аст ва ба пардозиши пеш аз он таъсир надорад. Ба pooyadev@protonmail.com нависед — ҳадди аксар дар зарфи як моҳ ҷавоб медиҳем. Метавонед ба CNPD (Лукзомбург, cnpd.public.lu) ё ба мақоми ҳифзи додаҳои кишвари худ шикоят кунед.

**Агар камтар аз 16 сол доред**, ризояти волидайн ё сарпараст лозим аст.

**Маҷмӯаҳои шахсӣ.** Масъули муҳтавои онҳо шумо ҳастед: додаҳои шахсии дигаронро дар онҳо нанависед.

### Ризояти волидайн ё сарпараст
Кӯдак ҳанӯз 16-сола нашудааст; барои ҳисоби ӯ мувофиқати шумо бо матни боло лозим аст. Номи шумо, таърих ва вироиши матнро то замоне ки ҳисоби кӯдак ҳаст нигоҳ медорем, то маълум бошад, ки кӣ ризоят додааст. Ҳар вақт метавонед ризоятро пас гиред: ба pooyadev@protonmail.com нависед; ҳисоби кӯдак пок мешавад.

Номи шумо: [поле]
☐ Ман яке аз волидайн ё сарпарасти ин кӯдак ҳастам ва мувофиқам.

---

## ru

### Данные в «Мане»
Версия 2 · 24.10.2026

«Мана» — личный некоммерческий проект Pooya для семьи и друзей. Связь: pooyadev@protonmail.com.

Если у вас есть аккаунт, мы храним:
– журнал занятий — на каждый ответ одна запись:
  · что вы учили: колода и её редакция, запись и её текст, навык, знакомство или повторение, какое занятие;
  · ваш ответ: набранный или распознанный текст, или что вы пропустили запись без ответа; автоматическая оценка и её причина; ваша поправка, если была; срок следующего повторения и как он рассчитан; время и часовой пояс;
  · способ ответа: голосом, с клавиатуры «Маны» или системной, или вставкой текста; длительность ответа (включая ожидание микрофона); сколько раз вы слушали звук и сколько раз пробовали ещё раз; сколько времени и записей прошло с предыдущей записи и с прошлого повторения той же записи; возвращалась ли запись в то же занятие;
  · читал запись звук из колоды или голос браузера, и имя голоса браузера;
  · распознавание речи: какая служба, на самом устройстве или нет, язык и языковой пакет, степень уверенности, другие варианты распознанного текста и какой выбран, отличия сказанного от текста записи, правила произношения, ошибки, подсказки распознавателю и показанная подсказка;
  · устройство; порядок поступления записей, время получения и контрольная сумма каждой;
– настройки: язык интерфейса, язык значений, число новых записей в день — и с какого устройства вы их изменили;
– список ваших устройств: имя устройства, когда оно последний раз связывалось с сайтом, версия приложения;
– запись о согласии: дата, версия этого текста и кто согласился; если согласие дал родитель или опекун — его имя;
– ваши личные колоды — если вы добавите их в аккаунт;
– при неудачной попытке входа по коду — IP-адрес в необратимо преобразованном виде (хэш), чтобы никто не мог подобрать код; он удаляется не позже чем через сутки.

Почту, пароль, дату рождения и ваш голос мы не храним.

**Зачем и на каком основании.** Чтобы вы могли заниматься на нескольких устройствах и не теряли прогресс. Основание — ваше согласие. Без аккаунта приложение работает только на этом устройстве и ничего нам не отправляет.

**Автоматическая оценка.** Приложение само оценивает ответ, чтобы назначить следующее повторение; оценку можно исправить. Других решений о вас приложение не принимает.

**Кто ещё получает данные:**
– Cloudflare хранит данные в Евросоюзе; обрабатывает их компания Cloudflare, Inc. (США) по договору об обработке данных. Передача в США основана на решении Еврокомиссии об EU–US Data Privacy Framework, которое признаёт защиту данных в американских компаниях — участниках этой системы достаточной. Как и любой сайт, Cloudflare видит IP-адрес вашего устройства каждый раз, когда оно обращается к сайту.
– Распознавание речи делает браузер, а не «Мана»: Chrome отправляет вашу речь в Google, Edge — в Microsoft. «Мана» звук не хранит и не отправляет.
– Если у записи нет звукового файла, её читает голос браузера; в Chrome на компьютере и в голосах «Online» в Edge этот голос отправляет текст записи в Google или Microsoft.

**Сколько храним.** Пока у вас есть аккаунт. После удаления аккаунта данные стираются сразу, из резервных копий — не позже чем через 30 дней.

**Ваши права.** Вы можете получить копию своих данных файлом, исправить их, ограничить их обработку, перенести их в другое место (файл JSON) или удалить аккаунт. Согласие можно отозвать в любой момент — это означает удаление аккаунта и не влияет на обработку до отзыва. Напишите на pooyadev@protonmail.com — ответим не позже чем через месяц. Пожаловаться можно в CNPD (Люксембург, cnpd.public.lu) или в орган по защите данных своей страны.

**Если вам нет 16 лет**, нужно согласие родителя или опекуна.

**Личные колоды.** За их содержание отвечаете вы: не вписывайте в них личные данные других людей.

### Согласие родителя или опекуна
Ребёнку ещё нет 16 лет; для его аккаунта нужно ваше согласие с текстом выше. Ваше имя, дату и версию текста мы храним, пока существует аккаунт ребёнка, — чтобы было видно, кто дал согласие. Согласие можно отозвать в любой момент: напишите на pooyadev@protonmail.com — аккаунт ребёнка будет удалён.

Ваше имя: [поле]
☐ Я родитель или опекун этого ребёнка и согласен(на).

---

## en

### Your data in Mana
Version 2 · 24 October 2026

Mana is a personal, non-commercial project by Pooya for family and friends. Contact: pooyadev@protonmail.com.

If you have an account, we store:
– your study log — one record per answer:
  · what you studied: deck and its revision, entry and its text, skill, introduction or review, which session;
  · your answer: the typed or recognised text, or that you skipped the entry without answering; the automatic grade and its reason; your correction, if any; the next review date and how it was calculated; time and time zone;
  · how you answered: by voice, on Mana's keyboard or the system keyboard, or by pasting text; how long the answer took (including waiting for the microphone); how many times you played the audio and how many times you tried again; how much time and how many entries passed since the previous entry and since the last review of the same entry; whether the entry came up again in the same session;
  · whether the deck's audio or the browser voice read the entry, and the browser voice's name;
  · speech recognition: which service, on the device itself or not, language and language pack, confidence level, alternative recognised texts and which one was chosen, differences between what you said and the entry text, pronunciation rules, errors, recogniser hints and the hint shown;
  · the device; the order in which records arrived, the time of receipt and the hash of each;
– settings: interface language, meaning language, new entries per day — and from which device you changed them;
– your devices: device name, when it last contacted the site, app version;
– a consent record: date, version of this text and who agreed; if a parent or guardian agreed — their name;
– your own decks — if you add them to your account;
– after a failed sign-in with a code — your IP address in an irreversibly transformed form (hash), so that nobody can guess the code; it is deleted within a day at most.

We do not store your email, a password, your date of birth or your voice.

**Why and on what basis.** So that you can study on several devices without losing progress. The legal basis is your consent. Without an account the app works only on this device and sends nothing to us.

**Automatic grading.** The app grades your answer itself to schedule the next review; you can correct the grade. The app makes no other decisions about you.

**Who else receives data:**
– Cloudflare stores the data in the European Union; it is processed by Cloudflare, Inc. (USA) under a data processing agreement. The transfer to the USA is based on the European Commission's decision on the EU–US Data Privacy Framework, which recognises data protection at participating US companies as adequate. Like any website host, Cloudflare sees your device's IP address every time it contacts the site.
– Your browser does the speech recognition, not Mana: Chrome sends your speech to Google, Edge to Microsoft. Mana neither stores nor sends the audio.
– If an entry has no audio file, the browser voice reads it; in Chrome on a computer and with Edge "Online" voices, this voice sends the entry text to Google or Microsoft.

**How long we keep it.** As long as you have an account. When the account is deleted, the data is erased immediately, and from backups within 30 days at most.

**Your rights.** You can get a copy of your data as a file, have it corrected, restrict its processing, take it elsewhere (JSON file) or delete your account. You can withdraw your consent at any time — this means deleting your account and does not affect processing before the withdrawal. Write to pooyadev@protonmail.com — we reply within one month at most. You can complain to the CNPD (Luxembourg, cnpd.public.lu) or to the data protection authority of your country.

**If you are under 16**, a parent or guardian must agree.

**Your own decks.** You are responsible for their content: do not put other people's personal data in them.

### Consent of a parent or guardian
The child is not yet 16; their account needs your agreement with the text above. We keep your name, the date and the version of the text as long as the child's account exists, so that it is clear who gave consent. You can withdraw consent at any time: write to pooyadev@protonmail.com — the child's account will be deleted.

Your name: [field]
☐ I am a parent or guardian of this child and I agree.
