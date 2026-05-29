/* SO-101 part metadata - keyed by STL mesh name (userData.partId).
   Used by the part inspector + part-explorer tour. Turkish copy. */
window.SO101 = window.SO101 || {};
window.SO101.PARTS = {
  base_so101_v2: {
    name: 'Taban Gövdesi',
    type: 'Yapısal · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Kolu masaya sabitleyen ana taban. Yaw (dönüş) servosunu ve montaj plakasını taşır; tüm yükü buraya aktarır.',
    tags: ['Açık STL', 'Onarması kolay'],
  },
  base_motor_holder_so101_v1: {
    name: 'Taban Motor Tutucu',
    type: 'Braket · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Taban yaw servosunu hizada tutan baskı braket. Servoyu tabana kilitler.',
    tags: ['Baskı braket'],
  },
  waveshare_mounting_plate_so101_v2: {
    name: 'Montaj Plakası',
    type: 'Donanım · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Seri bus sürücü kartının ve kabloların bağlandığı Waveshare uyumlu taban plakası.',
    tags: ['Waveshare', 'Kablolama'],
  },
  sts3215_03a_v1: {
    name: 'Feetech STS3215 Servo',
    type: 'Aktüatör',
    material: 'Metal dişli · seri bus',
    qty: '×6',
    desc: 'Pozisyon ve tork geri beslemeli akıllı seri servo. Kolun her eklemini sürer; tek hattan zincirleme bağlanır.',
    tags: ['Metal dişli', 'Geri besleme', '12V'],
  },
  sts3215_03a_no_horn_v1: {
    name: 'STS3215 Servo · Bilek',
    type: 'Aktüatör',
    material: 'Metal dişli · seri bus',
    qty: '×1',
    desc: 'Bilek modülüne gömülü, horn’suz STS3215 servo. Pitch eksenini kompakt biçimde sürer.',
    tags: ['Metal dişli', 'Kompakt'],
  },
  motor_holder_so101_base_v1: {
    name: 'Omuz Motor Tutucu',
    type: 'Braket · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Omuz pitch servosunu döner gövdeye bağlayan braket. Yaw ve pitch eksenlerini birbirine taşır.',
    tags: ['Baskı braket'],
  },
  rotation_pitch_so101_v1: {
    name: 'Omuz Döner Eklem',
    type: 'Eklem · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Taban dönüşünü omuz kaldırma eksenine bağlayan döner gövde. Kolun ilk büyük mafsalı.',
    tags: ['2 eksen geçiş'],
  },
  upper_arm_so101_v1: {
    name: 'Üst Kol',
    type: 'Bağlantı · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Omuz ile dirsek arasındaki ana kol segmenti. Servoları içine alan kafes yapı, hafif ve sağlam.',
    tags: ['Kafes yapı', 'Hafif'],
  },
  under_arm_so101_v1: {
    name: 'Ön Kol',
    type: 'Bağlantı · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Dirsek ile bilek arasındaki segment. Bilek modülünü ve tutucuyu uç noktaya taşır.',
    tags: ['Erişim kolu'],
  },
  motor_holder_so101_wrist_v1: {
    name: 'Bilek Motor Tutucu',
    type: 'Braket · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Bilek servosunu ön kola bağlayan braket. Bilek pitch eksenini konumlar.',
    tags: ['Baskı braket'],
  },
  wrist_roll_pitch_so101_v2: {
    name: 'Bilek Modülü',
    type: 'Eklem · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Pitch ve roll hareketini birlikte sağlayan bilek gövdesi. Tutucuya iki eksen serbestlik verir.',
    tags: ['Pitch + Roll'],
  },
  wrist_roll_follower_so101_v1: {
    name: 'Bilek Roll Flanşı',
    type: 'Eklem · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Tutucuyu kendi ekseninde döndüren roll çıkış flanşı. Son eksen.',
    tags: ['Roll çıkışı'],
  },
  moving_jaw_so101_v1: {
    name: 'Hareketli Çene',
    type: 'Uç efektör · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Paralel tutucunun hareketli çenesi. Sabit çeneyle birlikte nesneleri kavrar; uçları değiştirilebilir.',
    tags: ['Paralel tutucu', 'Modüler uç'],
  },

  // ---- Leader (kontrolcü) kola özel parçalar ----
  leader_handle: {
    name: 'Leader Tutamağı',
    type: 'Kontrol kabzası · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Operatörün elle kavradığı kontrol kabzası. Leader kolu bu tutamaktan yönlendirir, follower kol hareketi birebir taklit eder. Üstteki kanca, kullanılmadığında asarak saklamayı kolaylaştırır.',
    tags: ['Elle yönlendirme', 'Leader'],
  },
  leader_trigger: {
    name: 'Leader Tetiği',
    type: 'Kontrol · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Tutamağın tetiği. Sıkıldığında follower kolun tutucusunu açıp kapatır; teleoperasyonda kavrama kontrolünü sağlar.',
    tags: ['Tetik', 'Tutucu kontrolü'],
  },
  leader_wrist_roll: {
    name: 'Leader Bilek Roll',
    type: 'Eklem · 3D baskı',
    material: 'PLA / PETG',
    qty: '×1',
    desc: 'Leader kolun bilek roll çıkışı. Tutamağı kendi ekseninde döndürür ve bu hareketi follower kola aktarır.',
    tags: ['Roll çıkışı', 'Leader'],
  },
};

/* Display order for the explorer tour (base → end-effector).
   Shared spine is identical; only the end-effector parts differ between modes. */
const SO101_SPINE = [
  'base_so101_v2',
  'base_motor_holder_so101_v1',
  'waveshare_mounting_plate_so101_v2',
  'sts3215_03a_v1',
  'motor_holder_so101_base_v1',
  'rotation_pitch_so101_v1',
  'upper_arm_so101_v1',
  'under_arm_so101_v1',
  'motor_holder_so101_wrist_v1',
  'wrist_roll_pitch_so101_v2',
  'sts3215_03a_no_horn_v1',
];
window.SO101.PART_ORDER_FOLLOWER = SO101_SPINE.concat([
  'wrist_roll_follower_so101_v1',
  'moving_jaw_so101_v1',
]);
window.SO101.PART_ORDER_LEADER = SO101_SPINE.concat([
  'leader_wrist_roll',
  'leader_handle',
  'leader_trigger',
]);
// back-compat default (follower)
window.SO101.PART_ORDER = window.SO101.PART_ORDER_FOLLOWER;
