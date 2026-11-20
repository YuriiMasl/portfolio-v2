"""Focused portfolio contract + all local resource checks.
Run: skpy tools/check_portfolio.py [http://127.0.0.1:PORT/]
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import urlopen
import json
import re
import sys
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
CSS = (ROOT / 'hero.css').read_text(encoding='utf-8')
JS = (ROOT / 'workshop.js').read_text(encoding='utf-8')
BASE_URL = sys.argv.pop(1) if len(sys.argv) > 1 else None


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []
        self.feed(HTML)

    def handle_starttag(self, tag, attributes):
        self.elements.append((tag, dict(attributes)))


DOCUMENT = Document()


def local_resources():
    resources = set()
    for tag, attrs in DOCUMENT.elements:
        key = 'href' if tag == 'link' else 'src'
        value = attrs.get(key, '')
        if value and not urlsplit(value).scheme:
            resources.add(urlsplit(value).path)
    for filename in ('workshop.css', 'hero.css'):
        text = (ROOT / filename).read_text(encoding='utf-8')
        for value in re.findall(r'url\([\"\']?([^\)\"\']+)', text):
            if not urlsplit(value).scheme and not unquote(value).startswith('#'):
                resources.add(value)
    return sorted(resources)


class PortfolioChecks(unittest.TestCase):
    def test_resources_are_self_contained(self):
        for resource in local_resources():
            with self.subTest(resource=resource):
                path = (ROOT / unquote(resource)).resolve()
                self.assertTrue(path.is_relative_to(ROOT))
                self.assertTrue(path.is_file(), resource)
                self.assertGreater(path.stat().st_size, 0)
                if path.suffix in ('.webp', '.png', '.jpg'):
                    with Image.open(path) as image:
                        image.verify()

    def test_hero_offers_direct_contact_and_case_browse(self):
        hero = HTML.split('<section class="hero"', 1)[1].split('</section>', 1)[0]
        links = re.findall(r'<a\b[^>]+href="([^"]+)"', hero)
        self.assertEqual(links, ['https://t.me/IOpaWho', '#work'])
        self.assertIn('Написать в Telegram', hero)
        self.assertIn('Смотреть проекты', hero)
        self.assertEqual(hero.count('class="line-in"'), 2)
        self.assertIn('Стадия каждого обозначена честно', hero)
        layout = json.loads((ROOT / 'assets' / 'hero-layout.json').read_text(encoding='utf-8'))
        self.assertEqual(layout['text']['cta'], 'Написать в Telegram')
        self.assertIn('Три проекта: два демо-сайта и концепт', layout['text']['facts'])

    def test_case_catalog_selects_each_project(self):
        catalog = HTML.split('<section class="case-index"', 1)[1].split('</section>', 1)[0]
        destinations = re.findall(r'<a class="case-shelf__item" href="([^"]+)"', catalog)
        self.assertEqual(destinations, ['#case-flowers', '#smena', '#luma'])
        self.assertIn('assets/lyublyu-hero.webp', catalog)
        self.assertIn('assets/smena-hero.webp', catalog)
        self.assertIn('cases/luma/screenshots/dashboard.jpg', catalog)
        self.assertIn('Демо-сайт', catalog)
        self.assertIn('Концепт продукта', catalog)

    def test_hero_frame_fits_and_keeps_the_floor(self):
        """Кадр помещается в окно целиком, а фон живёт внутри кадра — иначе стойка уезжает с пола."""
        self.assertIn('.hero-plate > .hero-bg', CSS)
        self.assertIn('--plate-stretch', CSS)
        self.assertIn('--plate-stretch', HTML)
        self.assertIn('height: clamp(620px, 100svh, 1200px)', CSS)
        self.assertIn('Math.min(hero.clientWidth / 1600, hero.clientHeight / 900)', HTML)
        self.assertNotIn('window.innerHeight / 900', HTML)

    def test_hero_appears_only_when_placed(self):
        """Сцена не показывается, пока не посчитан масштаб и не применена раскладка."""
        layout_js = (ROOT / 'hero-layout.js').read_text(encoding='utf-8')
        self.assertIn('html.hero-ready .hero-stage', CSS)
        self.assertIn("classList.add('hero-ready')", layout_js)
        self.assertLess(HTML.index('--stage-scale'), HTML.index('<section class="case-index"'))

    def test_real_screen_and_supplied_layers(self):
        for name in ('workshop', 'stand', 'glass', 'screen-main'):
            self.assertIn('assets/hero/' + name + '.webp', HTML)
        self.assertEqual(HTML.count('<figure class="exhibit-panel '), 1)
        self.assertNotIn('has-plate', HTML)
        self.assertNotIn('stage-canvas', HTML)
        self.assertNotIn('hero-plate-v3', HTML)
        # The main screen is the supplied screenshot, not a fake UI.
        for new, original in [('screen-main', 'lyublyu-hero')]:
            with Image.open(ROOT / 'assets' / 'hero' / (new + '.webp')) as image:
                with Image.open(ROOT.parent / 'ассеты' / (original + '.webp')) as source:
                    self.assertEqual(image.size, source.size)

    def test_anchor_destinations_and_contacts_preserved(self):
        ids = [attrs['id'] for _, attrs in DOCUMENT.elements if 'id' in attrs]
        self.assertEqual(len(ids), len(set(ids)))
        for tag, attrs in DOCUMENT.elements:
            href = attrs.get('href', '')
            if tag == 'a' and href.startswith('#'):
                self.assertIn(href[1:], ids)
        telegram = [a for t, a in DOCUMENT.elements if t == 'a' and a.get('href') == 'https://t.me/IOpaWho']
        self.assertEqual(len(telegram), 3)  # header + hero + contact
        menu = HTML.split('<details class="mobile-menu">', 1)[1].split('</details>', 1)[0]
        self.assertEqual(re.findall(r'<a href="([^"]+)"', menu), ['#work', '#services', '#process', '#about', '#faq', '#contact'])
        self.assertEqual(HTML.count('<details class="faq-item">'), 6)
        self.assertIn('<dt>Сайт под ключ</dt>', HTML)
        self.assertIn('<dt>Каталог товаров и услуг</dt>', HTML)
        self.assertIn('<dt>Редизайн сайта</dt>', HTML)
        self.assertNotIn('Отвечу в тот же день', HTML)
        self.assertIn("if (menu) menu.open = false", JS)
        self.assertIn('tel:+79292322074', HTML)
        self.assertIn('https://yuriimasl.github.io/lyublyu-demo/', HTML)

    def test_motion_fallback_and_native_scrolling(self):
        self.assertIn('prefers-reduced-motion: reduce', JS)
        self.assertIn("range.addEventListener('input', paint)", JS)
        self.assertNotIn('Lenis', JS)
        self.assertNotIn('preventDefault', JS)
        self.assertNotIn('repeat: -1', JS)
        self.assertIn('@media (max-width: 560px)', CSS)
        self.assertIn('min-height: 44px', CSS)
        self.assertNotRegex(CSS, r'\.hero-copy\s*\{[^}]*opacity:\s*0')

    def test_smena_case_is_presented(self):
        self.assertIn('id="smena"', HTML)
        self.assertIn('href="cases/smena/"', HTML)
        self.assertIn('assets/smena-hero.webp', HTML)
        self.assertIn('assets/smena-mobile.webp', HTML)
        self.assertIn('три демо-кейса', HTML)
        self.assertIn('Цветочный салон', HTML)
        self.assertIn('Кофейня и обжарка', HTML)
        self.assertIn('LUMA', HTML)
        self.assertIn('придуманы', HTML)

    def test_smena_case_files_exist(self):
        case = ROOT / 'cases' / 'smena'
        html = case / 'index.html'
        self.assertTrue(html.is_file(), html)
        self.assertGreater(html.stat().st_size, 0)
        text = html.read_text(encoding='utf-8')
        self.assertIn('<h1', text)
        self.assertIn('Смена', text)
        for rel in (
            'styles.css',
            'script.js',
            'assets/fonts/fonts.css',
            'assets/img/hero.jpg',
            'assets/img/bar2.jpg',
            'assets/img/table2.jpg',
        ):
            path = case / rel
            self.assertTrue(path.is_file(), path)
            self.assertGreater(path.stat().st_size, 0)
        for name, size in (('smena-hero.webp', (1430, 900)), ('smena-mobile.webp', (390, 844))):
            path = ROOT / 'assets' / name
            self.assertTrue(path.is_file(), path)
            with Image.open(path) as image:
                self.assertEqual(image.size, size)

    def test_luma_case_files_exist(self):
        case = ROOT / 'cases' / 'luma'
        html = case / 'index.html'
        self.assertTrue(html.is_file(), html)
        text = html.read_text(encoding='utf-8')
        self.assertIn('LUMA', text)
        self.assertIn('Интерактивная демонстрация', text)
        for rel in (
            'styles.css',
            'app.js',
            'assets/nina.svg',
            'assets/mark.svg',
            'assets/alisa.svg',
            'screenshots/dashboard.jpg',
            'screenshots/calendar.jpg',
            'screenshots/calendar-day.jpg',
            'screenshots/appointments.jpg',
            'screenshots/booking.jpg',
            'screenshots/client-home.jpg',
            'screenshots/mobile-booking.jpg',
        ):
            path = case / rel
            self.assertTrue(path.is_file(), path)
            self.assertGreater(path.stat().st_size, 0)
        for name, size in (
            ('dashboard.jpg', (1440, 900)),
            ('calendar.jpg', (1440, 900)),
            ('booking.jpg', (1440, 900)),
            ('mobile-booking.jpg', (375, 844)),
        ):
            with Image.open(case / 'screenshots' / name) as image:
                self.assertEqual(image.size, size)

    @unittest.skipUnless(BASE_URL, 'Pass the live preview URL to check HTTP resources')
    def test_http_all_resources(self):
        for resource in [''] + local_resources():
            with self.subTest(resource=resource):
                with urlopen(urljoin(BASE_URL, resource), timeout=8) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
        print(f'HTTP resources: {len(local_resources()) + 1} OK')

    @unittest.skipUnless(BASE_URL, 'Pass the live preview URL to check HTTP resources')
    def test_smena_http(self):
        for rel in (
            'cases/smena/',
            'cases/smena/styles.css',
            'cases/smena/script.js',
            'cases/smena/assets/img/hero.jpg',
            'cases/smena/assets/img/bar2.jpg',
            'cases/smena/assets/img/table2.jpg',
        ):
            with self.subTest(rel=rel):
                with urlopen(urljoin(BASE_URL, rel), timeout=8) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
        print('Smena HTTP resources: 6 OK')

    @unittest.skipUnless(BASE_URL, 'Pass the live preview URL to check HTTP resources')
    def test_luma_http(self):
        for rel in (
            'cases/luma/',
            'cases/luma/styles.css',
            'cases/luma/app.js',
            'cases/luma/assets/nina.svg',
            'cases/luma/assets/mark.svg',
            'cases/luma/assets/alisa.svg',
            'cases/luma/screenshots/dashboard.jpg',
            'cases/luma/screenshots/calendar.jpg',
            'cases/luma/screenshots/calendar-day.jpg',
            'cases/luma/screenshots/appointments.jpg',
            'cases/luma/screenshots/booking.jpg',
            'cases/luma/screenshots/client-home.jpg',
            'cases/luma/screenshots/mobile-booking.jpg',
        ):
            with self.subTest(rel=rel):
                with urlopen(urljoin(BASE_URL, rel), timeout=8) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
        print('LUMA HTTP resources: 13 OK')


if __name__ == '__main__':
    unittest.main(verbosity=2)
