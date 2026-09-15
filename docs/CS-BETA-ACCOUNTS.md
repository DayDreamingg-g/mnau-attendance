# Облікові записи Computer Science beta

| Викладач | Email |
|---|---|
| ст.в. Богатєнкова О.Є. | bohatienkova.oye@test.com |
| ст.в. Болотських | bolotskykh@test.com |
| доц. Ганніченко Т.А. | hannichenko.ta@test.com |
| ст.в. Гусенко А.А. | husenko.aa@test.com |
| ст.в. Ємельянов С.І. | yemelianov.si@test.com |
| ас. Жебко О.О. | zhebko.oo@test.com |
| ст.в. Коломієць А.М. | kolomiiets.am@test.com |
| доц. Марковська А.В. | markovska.av@test.com |
| ас. Мірошник Р.С. | miroshnyk.rs@test.com |
| доц. Пархоменко О.Ю. | parkhomenko.oyu@test.com |
| доц. Побережець Г.С. | poberezhets.hs@test.com |
| ст.в. Поживатенко В.В. | pozhyvatenko.vv@test.com |
| проф. Полторак А.С. | poltorak.as@test.com |
| доц. Полянський П.М. | polianskyi.pm@test.com |
| доц. Пономаренко Н.Г. | ponomarenko.nh@test.com |
| доц. Садовий О.С. | sadovyi.os@test.com |
| ст.в. Суріна Г.Ю. | surina.hyu@test.com |
| доц. Тищенко С.І. | tyshchenko.si@test.com |
| ст.в. Хилько І.І. | khylko.ii@test.com |

| Староста групи | Email |
|---|---|
| КН 1/1 | starosta.kn1-1@test.com |
| КН 2/1 | starosta.kn2-1@test.com |
| КН 3/1 | starosta.kn3-1@test.com |
| КН 3/2 | starosta.kn3-2@test.com |
| КН 4/1 | starosta.kn4-1@test.com |

Куратор усіх п’яти груп: `curator.cs@test.com`. Розробник: `developer@test.com`.

Реліз 15.09.2026 зберігає ID, логіни, хеші паролів і призначення цих облікових записів. Після міграції видані TEST-акаунти мають один раз змінити свій поточний пароль. Наступні deploy цього не повторюють.

ADMIN/DEVELOPER скидає пароль на унікальний випадковий тимчасовий через інтерфейс. Він показується один раз; старі сеанси відкликаються. Відновлення спільного beta-пароля вимкнено. Старі db:seed / beta:prepare-cs / beta:repair-cs не запускати на робочій БД. Наявні admin і dean збережені, нові студентські акаунти не створюються.
