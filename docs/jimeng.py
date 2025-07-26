import os
import io
import re
import json
import time
import click
import random
import base64
import asyncio
import uvicorn
import aiohttp
import asyncio
import requests
import functools
import threading
import traceback
from PIL import Image
from typing import Optional
from fastapi import FastAPI, APIRouter
from playwright.async_api import async_playwright, Page, Playwright, Error as PlaywrightError, TimeoutError as PlaywrightTimeoutError
from cutils import times, jsons, logs, files, utils, rates

router = APIRouter()
oss_path = r'X:\oss' + os.sep
expand_path = oss_path + os.sep + 'expand_img' + os.sep
if os.environ.get('C_CUSTOM_KEY_MACHINE', '') == 'MY_DEV':
    oss_path = ""
window_lock = threading.Lock()
window_index = 0
windows = [
   
    {
        'name': '即梦028',
    },
    {
        'name': '即梦023',
    },
    {
        'name': '即梦022',
    }
]
if os.environ.get('C_CUSTOM_KEY_MACHINE', '') == 'MY_DEV':
    windows = [
        {
            'name': '即梦027',
            'window_id': 'beeed84585834cc08d52eb6c15ac8483',
            'debug_url': 'http://127.0.0.1:9221',
            'token_bucket': rates.TokenBucket(5, 5),
            'instance': None,
        }
    ]


class BizException(Exception):
    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class AlertException(Exception):
    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# noinspection DuplicatedCode
def log_decorator(func):
    # noinspection DuplicatedCode
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start_at = times.now_sec_f()
        try:
            response = await func(*args, **kwargs)
            logs.log.info(f"request suc: {func.__name__}, use {times.now_sec_f() - start_at:.3f}s, response={jsons.dump(response)}")
        except Exception as exc:
            logs.log.exception(f"request err: {func.__name__}, use {times.now_sec_f() - start_at:.3f}s, err={str(exc)}")
            raise exc
        return response

    return wrapper


@router.get("/health")
@log_decorator
async def health():
    return resp_ok({'time': times.now_str()})


@router.post("/path/expand")
async def jimeng_i2v(request: dict):
    request_id = utils.uuid()
    logs.log.info(f"[{request_id}] jimeng_i2v  path start, request={request}")
    
    input_image = request['image_path']
    base_dir = await check_base_dir()
    try:
        response = await process_img(input_image , request_id, base_dir)
        return response
    except Exception as e:
        traceback.print_exc()



@router.post("/base64/expand")
async def jimeng_i2v(request: dict):
    request_id = utils.uuid()
    logs.log.info(f"[{request_id}] jimeng_i2v  base64 start")
    base_dir = await check_base_dir()
    img_base64 = request['image_base64']
    input_image = await save_base64_image_to_temp(img_base64, request_id, base_dir)
    try:
        response = await process_img(input_image , request_id, base_dir)
        return response
    except Exception as e:
        traceback.print_exc()

async def check_base_dir():
    formatted_date = time.strftime("%Y-%m-%d") 
    base_dir = expand_path + os.sep + formatted_date + os.sep
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    return base_dir 


async def process_img(input_img , request_id, base_dir):
    logs.log.info(f"[{request_id}] process_img start, input_img={input_img}")
    start_at = times.now_sec_f()
    try:
        output_path = await jimeng_expand(input_img, request_id)
        logs.log.info(f"response images = {output_path}")
        inner_imgs = await download_image(output_path , request_id, base_dir)
        response = resp_ok({
            'output_images': inner_imgs,
        })
        logs.log.info(f"[{request_id}] request suc: jimeng_expand, use {times.now_sec_f() - start_at:.3f}s, response={jsons.dump(response)}")
        return response
    except BizException as e:
        response = {'code': e.code, 'message': e.message}
        logs.log.info(f"[{request_id}] request err: jimenng_expand, use {times.now_sec_f() - start_at:.3f}s, response={jsons.dump(response)}, err={e.message}")
        return response
    except Exception as e:
        response = {'code': 1000, 'message': str(e)}
        logs.log.exception(f"[{request_id}] request err: jimenng_expand, use {times.now_sec_f() - start_at:.3f}s, response={jsons.dump(response)}, err={str(e)}")
        return response

async def save_base64_image_to_temp(img_base64: str, request_id: str, base_dir: str) -> str:
    # 解码 base64 字符串为字节
    image_data = base64.b64decode(img_base64)
    
    # 使用 PIL 打开图像
    image = Image.open(io.BytesIO(image_data))
    image_file_path = f"{base_dir}{os.sep}{request_id}.png"
    image.save(image_file_path, format="PNG")

    return image_file_path

async def download_image(image_urls, request_id, base_dir):
    
    inner_imgs = []
    try:
        for index, image_url in enumerate(image_urls):
            response = requests.get(image_url)
            response.raise_for_status()
            file_path = base_dir + os.sep + f'{request_id}_{index}.png'
            with open(file_path, 'wb') as f:
                f.write(response.content)
            relative_path = os.path.relpath(file_path, oss_path)

            inner_imgs.append(relative_path)
        return inner_imgs
    except Exception as e:
        traceback.print_exc()
        raise BizException(1004, f'[{request_id}] 图片下载失败')
    
def resp_ok(data):
    return {'code': 0, 'data': data, 'message': 'ok'}


# noinspection DuplicatedCode
def open_window(window_id, request_id=''):
    start_at = times.now_sec_f()
    while True:
        # noinspection PyShadowingNames
        try:
            logs.log.info(f'[{request_id}] 尝试打开窗口{window_id}')
            url = 'http://127.0.0.1:54345/browser/open'
            payload = json.dumps({
                'id': window_id,
                'args': ['--window-position=1380,400']
            })
            headers = {
                'Content-Type': 'application/json',
            }
            response = requests.request('POST', url, headers=headers, data=payload)
            response.raise_for_status()
            # print(response.text)
            body = jsons.load(response.text)
            if not body.get('success'):
                raise Exception(f'open window error, err={response.text}')
            data = body.get('data') or {}
            debug_url = data.get('http') or {}
            # noinspection HttpUrlsUsage
            return 'http://' + debug_url
        except Exception as e:
            traceback.format_exc()
            if '浏览器正在关闭中，请稍后操作' in str(e):
                if times.now_sec_f() - start_at > 300:
                    print('打开窗口失败')
                    raise
                time.sleep(1)
                continue
            raise


# noinspection DuplicatedCode
def close_window(window_id):
    url = 'http://127.0.0.1:54345/browser/close'
    payload = json.dumps({
        'id': window_id,
    })
    headers = {
        'Content-Type': 'application/json',
    }
    response = requests.request('POST', url, headers=headers, data=payload)
    response.raise_for_status()
    # print(response.text)
    body = jsons.load(response.text)
    if not body.get('success'):
        raise Exception(f'close window error, err={response.text}')


# noinspection DuplicatedCode
def get_window(window_id):
    url = 'http://127.0.0.1:54345/browser/detail'
    payload = jsons.dump({
        'id': window_id,
    })
    headers = {
        'Content-Type': 'application/json',
    }
    response = requests.request('POST', url, headers=headers, data=payload)
    response.raise_for_status()
    # print(response.text)
    body = jsons.load(response.text)
    if not body.get('success'):
        raise Exception(f'get_window error, err={response.text}')
    return body


# noinspection DuplicatedCode
def list_window():
    url = 'http://127.0.0.1:54345/browser/list'
    payload = jsons.dump({
        "page": 0,
        "pageSize": 100
    })
    headers = {
        'Content-Type': 'application/json',
    }
    response = requests.request('POST', url, headers=headers, data=payload)
    response.raise_for_status()
    # print(response.text)
    body = jsons.load(response.text)
    if not body.get('success'):
        raise Exception(f'list_window error, err={response.text}')
    results = []
    for window in body.get('data', {}).get('list', []):
        results.append({
            'id': window['id'],
            'name': window['name'],
        })
    return results

# noinspection DuplicatedCode
async def jimeng_expand(image_ref_path, request_id):
    global windows, window_index
    window = None
    start_at_lock = time.perf_counter()
    while window is None:
        if time.perf_counter() - start_at_lock > 60 * 5:
            raise Exception('get token bucket timeout')
        w = windows[window_index % len(windows)]
        window_index += 1
        if not w['token_bucket'].get_token(acquire=True):
            logs.log.info(f'[{request_id}] jimeng not get lock, image_ref_path={image_ref_path}')
            await asyncio.sleep(5)
            continue
        window = w
        break
    window_name = window['name']
    if window['instance'] is None:
        # noinspection PyTypeChecker
        logs.log.info(f'[{request_id}] jimeng init instance, image_ref_path={image_ref_path}')
        # todo 
        window['instance'] = await(await async_playwright().start()).chromium.connect_over_cdp(window['debug_url'])
    # noinspection PyTypeChecker
    # playwright_instance: Playwright = window['instance']
    # debug_url = window['debug_url']
    logs.log.info(f'[{request_id}] jimeng expand start, image_ref_path={image_ref_path}')

    page: Optional[Page] = None
    browser = window['instance']

    try:
        # browser = await playwright_instance.chromium.connect_over_cdp(debug_url)
        browser_context = browser.contexts[0]

        page = await browser_context.new_page()
        async with page.expect_response(re.compile('https://jimeng.jianying.com/commerce/v1/benefits/user_credit$'), timeout=31000) as response_info:
            await page.goto('https://jimeng.jianying.com/ai-tool/video/generate', wait_until='load', timeout=30000)
        response = await response_info.value
        response_str = await response.text()
        response_code = response.status
        body = jsons.load(response_str)
        # logs.log.info(f'[{request_id}] user_credit response = {response_str}')
        if response_code != 200 or body['ret'] != '0':
            raise Exception(f'[{window_name}] request error')
        gift_credit = body.get('data', {}).get('credit', {}).get('gift_credit', 0)
        purchase_credit = body.get('data', {}).get('credit', {}).get('purchase_credit', 0)
        vip_credit = body.get('data', {}).get('credit', {}).get('vip_credit', 0)
        total_credit = gift_credit + purchase_credit + vip_credit
        if total_credit < 15:
            windows = [w for w in windows if w['name'] != window_name]
            logs.log.info(f'[{request_id}] remove window, name={window_name}')
            message = f'[{window_name}] 积分不足'
            if os.environ.get('C_CUSTOM_KEY_MACHINE', '') != 'MY_DEV':
                utils.sendAlert('4960e97b-d3de-4a99-870a-597e2af40e6b', message)
            raise BizException(1100, message)

        # 点击图生视频
        # start_at_page_interaction = time.perf_counter()
        # while await page.locator('#lv-tabs-0-tab-1.lv-tabs-header-title-active').count() == 0:
        #     if time.perf_counter() - start_at_page_interaction > 30:
        #         raise Exception(f'[{window_name}] click video tab timeout')
        #     await page.click('#lv-tabs-0-tab-1.lv-tabs-header-title')
        #     await asyncio.sleep(5)
        file_path = image_ref_path
        if not os.path.exists(file_path):
            raise Exception(f'[{window_name}] input_path not exists, file_path={file_path}')
        
        img = Image.open(file_path)
        width, height = img.size
        scale = 1080 / height
        if scale > 3:
            raise BizException(1005, f'[{window_name}] 图片尺寸过低，无法上传')
        
        async with page.expect_response(re.compile('https://jimeng.jianying.com/mweb/v1/painting'), timeout=61000) as painting_response_info:
            await page.goto("https://jimeng.jianying.com/ai-tool/image-edit")
            try:
                await page.locator('.selectArrowIconContainer-eSm09s > svg').click()
                await page.locator('.iconWrap-SHOAs4').nth(7).click()
                await page.locator('.selectArrowIconContainer-eSm09s > svg').click()

                file_input = page.locator('.uploadFileDiv-_z6JmT > input[type="file"]').first
                await file_input.set_input_files(file_path)
                start_at = time.perf_counter()
                # 上传文件
                await page.locator('.uploadFileDiv-_z6JmT > input[type="file"]').first.set_input_files(file_path)
                # 点击画布
                await page.locator('.editor-ui-configuration-tool-bar-group > button[type="button"]').nth(1).click()

                #await page.locator('#editor-ui-configuration-tool-bar-container ').nth(3).click()
        
                await page.locator('.radio-group-Thggub >> label:has-text("9:16")').click()
                await page.locator('.out-paint-button-qayl32 >> div:has-text("扩图")').click()
            except PlaywrightTimeoutError:
                windows = [w for w in windows if w['name'] != window_name]
                logs.log.info(f'[{request_id}] 请求页面位置超时, name={window_name}')
                traceback.print_exc()
                await page.close()
                message = f'[{window_name}] 请求页面位置超时'
                if os.environ.get('C_CUSTOM_KEY_MACHINE', '') != 'MY_DEV':
                    utils.sendAlert('4960e97b-d3de-4a99-870a-597e2af40e6b', message)
                raise BizException(1006, message)
        response = await painting_response_info.value
        response_str = await response.text()
        #logs.log.info(f'[{request_id}] generate_video response = {response_str}')
        body = jsons.load(response_str)
        if response.status != 200 or body['ret'] != '0':
            if body['ret'] == '1' and body['errmsg'] == 'api rate limit':
                raise BizException(1003, f'[{window_name}] api限速')
            if body['ret'] == '1018':
                windows = [w for w in windows if w['name'] != window_name]
                logs.log.info(f'[{request_id}] remove window, name={window_name}')
                message = f'[{window_name}] 被封号'
            if os.environ.get('C_CUSTOM_KEY_MACHINE', '') != 'MY_DEV':
                utils.sendAlert('4960e97b-d3de-4a99-870a-597e2af40e6b', message)
                raise BizException(1101, message)
            raise Exception('request error') 
        
        images_url = []
        item_list = body.get('data', {}).get('item_list', [])
        try:
            for index, item in enumerate(item_list):
                large_images = item.get('image', {}).get('large_images', [])
                if large_images:
                    first_large_image = large_images[0]
                    image_url = first_large_image.get('image_url')
                    images_url.append(image_url)
        except Exception as e:
            traceback.print_exc()
            raise BizException(1004, f'[{window_name}] 解析图片URL失败')
        if len(images_url) == 0:
            raise BizException(1005, f'[{window_name}] 未找到图片URL')
        return images_url 
    finally:
        window['token_bucket'].release()
        if os.environ.get('C_CUSTOM_KEY_MACHINE', '') != 'MY_DEV1':
            if page:
                try:
                    await page.close()
                except Exception as e_close_page_final:
                    logs.log.error(f"Finally: Error closing page: {e_close_page_final}")


async def aio_get(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()


async def get_generate_btn_disabled(page: Page):
    element = page.locator('.mweb-button-default[class*=" generateButton-"]').nth(0)
    return await element.evaluate("el => el.classList.contains('disabled')")


async def do_test():
    # prompt = '主体：前景一碗汉源青花椒，背景一罐青花椒产品。运镜：镜头从前景碗中青花椒的细节特写开始，平稳推近以展示其饱满颗粒和清晰纹理，强调“颗粒硕大”的特点；随后缓慢拉远，同时轻微向上平移，使后方青花椒罐体的标签文字，特别是“青花椒”和“颗粒硕大·麻味纯正”字样，清晰呈现在画面中。环境：干净明亮的纯白背景，光线均匀。'
    # prompt = """**Formulating the Perfect Video Prompt**Okay, so I'm thinking about this video prompt. The user wants it in a specific JSON format, which is straightforward enough. My expertise tells me we need a clear structure: *主体 + 运镜 + 环境* (Subject + Camera Movement + Environment).The image is key: it's a close-up of a pink garment's elastic waistband and gathered fabric. My goal here is to really emphasize that detail, the texture, and the elasticity. So, the subject is clear: *粉色服装的弹性腰带和褶皱细节* (Pink garme"""
    await jimeng_i2v({'image_path': 'test.png'})
    # await jimeng('小尺寸.png', "Hello WorldHello WorldHello WorldHello WorldHello WorldHello World", utils.uuid())
    # await jimeng('微信图片_20250508170610.jpg', "Hello WorldHello WorldHello WorldHello WorldHello WorldHello World", utils.uuid())


def http(port):
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, swagger_ui_oauth2_redirect_url=None)
    app.include_router(router, prefix="/api")
    uvicorn.run(app, port=port, host="0.0.0.0")


# pip install click, uvicorn, fastapi, lark_oapi, loguru, pygments, cchardet, aiohttp, jsonpath
# pip install playwright
# playwright install
# noinspection PyUnusedLocal
@click.command()
@click.option("-cmd", type=str, help="")
def call_main(cmd: str):
    window_map: dict[str, dict] = {}
    for window in windows:
        window_map[window['name']] = window
    for w in list_window():
        name = w['name']
        if name in window_map:
            window_map[name]['window_id'] = w['id']
            window_map[name]['debug_url'] = ''
            window_map[name]['token_bucket'] = rates.TokenBucket(4, 4)
            window_map[name]['instance'] = None
    for window in windows:
        window_id = window['window_id']
        close_window(window_id)
        window['debug_url'] = open_window(window_id, utils.uuid())
    time.sleep(10)
    http(51050)


if __name__ == '__main__':
    try:
        logs.init_log(f'log/jimeng-api.log')
        if os.environ.get('C_CUSTOM_KEY_MACHINE', '') == 'MY_DEV':
            asyncio.run(do_test())
        else:
            call_main()
    except Exception as _e:
        print('err', _e)
        traceback.print_exc()
        raise