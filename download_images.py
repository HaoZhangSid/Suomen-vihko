import os
import requests
import sys
import time

# The data provided by the user is a Python list of lists
image_groups = [
    [
        "https://lh4.googleusercontent.com/6VnC8MQJuGzfWY540MTUB9oOj5lZaiYRuxJQyE0QITRCHseL8fdHsvvB1D_pp6i2J1SqayrdOz9VDAbM31iKQyAR0JBdamlcFumt18a2b7X7Zny1gEjhWsSjOfvHqAx189nITiStirA=w16383",
        "https://lh6.googleusercontent.com/Kc6no1pJy_XLwD8n4U4BbLhs7kZKsfubLsJ89UpTt63BE-ra-plq84lGE_d_hJyZUz5HTrWcQzBd-Pj9Q8Djk0vV3szrDU7cia9Q3HoxMysVW0CFmJQwzGwEPmnTw8QLJxVIL2V58WY=w16383",
        "https://lh3.googleusercontent.com/fxJ3otZC49t2ljS5bKaVjVXBgqNJHTXUgTr2bWzfANbu3AsroxkZ3ly9ouwBex4lc2jCQ6rjHOC0eIUMZEMKE7w8dau8okGx_wxWHWT3U1cuxSvLG9Tzy1y6bjGzJwKnt9NHVokPAG4=w16383",
        "https://lh3.googleusercontent.com/yjkYHWR5r3Xo4iFOqZ4DzAa6TB6VIhIctLwGjXMvEldoAAdU0chTPq-uycPiHL4uKIRef6P18Xug8323_8WoE6zLbNCAxm5Bg3YIZ5TO4VJrGJwnEKp14THcEE8X9lbolGjn3EfHue0=w16383"
    ],
    [
        "https://lh3.googleusercontent.com/COwfNBwJPOpEUrlY8p9gAdd-p9imxuKyvWB0rvoiPhS__8LvN7UmpSw6KEe53hZig75oMK_Dm4WJJrul-ptxJ1OcRPU8r6wttgOZ5OtHpKdrA6wjcP-zdlvfmQtz7xZCRvEJgbwjZGg=w16383",
        "https://lh5.googleusercontent.com/5_e3hFPyojk063gZ8QJNxWRrG4BFIpUYAeKUQ8yqOGawJ7dgsvlWE-h8uOcq2JI7agad0kJoRcsCeFJc_UN-Rw_LagyubguJjK2tMSGkwCJLAphw9on2pfMGrF29YXs3hgMPOOwZOQ=w16383"
    ],
    [
        "https://lh6.googleusercontent.com/QC7Z3bjErfzmfRazq2fjLW9xGplyFwpKGwaJSXhJcPCPZkw6jqeuM53pm2Pv2QDOKMfc2n-gaM3cQYC9jQePscMrVKMZrI_2BO38j8ArzOViB3Ad466h7mbT3LVO-rbFp9-mxgWFHrM=w16383",
        "https://lh4.googleusercontent.com/K6tOk00YuhXyBrPN7I-LDjf_3vE1VmnOoOSzj9dl26rGf2l3eKaxOg-1PmPOSYZIv5hEDclVckp-_Ri5AGJyStdU2u2lUE-z5uNRHcrN_OzCf--akJPKbxqCJB6QPfrNT-v9J33F0A=w16383",
        "https://lh6.googleusercontent.com/dGV7SR1bME7mQEZiaHtTBKlC1q2rFByki0XEN0PMyHiWTZWCo6nEMpsgBUZ099LxHlsdGFZeN1C4FihvScL7eo-t-F-EItyhkTQwTFWDrbfNjhXG3E083Gl0Avd7NctG-Twn7KHfkBw=w16383",
        "https://lh3.googleusercontent.com/6p8ZBbxX8Ud9kuiq3XWknOULCvQ9ztUDJ_lMyPMbhnzHxBKv_aunshX13rhwXxoxrGPBMgMf0oMHxUKVl1WVbEo3peTa8nUMuxvFZMePIVdAhUDrrLEIOgwkCYJKuwQiZu2B9auZ8dI=w16383"
    ],
    [
        "https://lh4.googleusercontent.com/RXcWCIJUxZ_FNeZDBPO-rmB5tQPcuIqIfjpKoapDQm_-lhvQyW69ekmqKYnI6rdxg0nKIZYY36V-muYQ93uVk2dYcgQ25XmFc64h-OfaApYP3mMGpIziOH3bNOqm47RcXp23DsfQmeQ=w16383",
        "https://lh4.googleusercontent.com/k6Y_jZQw73GndxQNVCbw_Hh6fNmh-uZep_sh1CcV5K8yJ8SNIv-SYjVMlBjursWMlsLfPc5h-J3wLOowt0aFMZHHUbGYwQ201FUZhqlp_AP_h5oTcAcS4SYAAHbDiPmQYQVx6iDAEao=w16383",
        "https://lh4.googleusercontent.com/8bufmW9duyn-pB8aDJMxHCAEEwI8wd8NG68__k6Ew1tRPMG7W39Kp6mvumHryzibEcmLBW5-uBW4Wz3RrOnNwLIVzeenfGgTZBcJd6jY_lh2OyTHFK5f6hwARmXztBmqsw3tv64AniU=w16383"
    ],
    [
        "https://lh3.googleusercontent.com/_3PBP8Y6wQQ7o8Giqh-RQOMWdL2N2orSRfSZaCfoC8lCDcA0SaQw1QKcRbH9Y-PkMYNU2OIVR6c4FJmTCOtCMLoFLlQuexGbZNk056mwFrXmO3GZnN8x46qYWKvznuoN_MgR2dEK5ow=w16383",
        "https://lh3.googleusercontent.com/sypunbArIjMljXYE2RNX1Xr2GphSoCl8_nq3eTPAi9ygvQnqicXIwY2XyoA_3A7x4dA1RAGlrGwAfMuLmgRqJfwCvxzexixggd2d_HTtg9grhNMVTZFeLC3prrMJbb6Zx9c_RtLf_jE=w16383",
        "https://lh6.googleusercontent.com/VoDfOc2Ev6Ywh2Z8q9bQ96qjqImJVR-ms8EFUM8GPsa-LA2cpK8SBZuBjYIqJl7fqOX9uQJng-Ta7-rpqabromTF6JaftdcKEg4sTOvbpU_TtAMndZJkYbEdKIiCkn_CWK0-ZZhz-g=w16383",
        "https://lh3.googleusercontent.com/tv-4OWu4hvGptgKwvgo-V48EIxhMeCXLa6JfouwH8sLsPlif8e8z3ae7XscjKDzlgNbw0W1Xi4igpE55SAKz1aQOCgN4a9oOUgh1ZHoV1Ocw2IRnvwFZvcWp3qdxGvQh8WKvyi18XHs=w16383",
        "https://lh5.googleusercontent.com/mj42Kt4kz7ln-i9y5NNomP_aEueG6jHjtKkjbazpb2jvz-rI8ELb7R8oNxw7i7Odd3FK9fCU2tCiAhRHJoTYKiS00FUpVSoZg4HaC2--s8tyuBF9iDTx3zWKVk5fxAHyT0Upd2gbd0M=w16383"
    ],
    [
        "https://lh3.googleusercontent.com/pgie__ZfOCURpv1E6uG2dzxPGiFEAyCkt2BQ2LbDAP6QHdcQJxj1HkQj1P-hicsv9hxcMaDZpta_-rmXKmR4wIfXDPzoFHXxqhCahaHWcoaeLlRFyOIOnc-6dtz_MRMoqViGGERBMgs=w16383",
        "https://lh4.googleusercontent.com/ZT8kDr3_fMz9bnMCh1aYdRGoVUK32KZFWPEqtjHtWm7ApkwAozJA7RYzt_EFQwMvziotSBjDdTJw8aOWA7EM9pLBZ7stguTvkp-d_cfGcRx9FTmn_djJsp7lUpVVZ7xE749gAyXdRO0=w16383",
        "https://lh4.googleusercontent.com/MxzzH7KW78FEjI4PIEaJrq5ELPD3fmhLQmfLmVktiYMbGH-IQKkJbU0CdwdS8M4jOCiPmVfaVhR509HH59UD0G1D-jM_i-6i9gCatvQ3McAAPTmDvyQikUuztT6XYn3MEn2m74ZT9mY=w16383",
        "https://lh4.googleusercontent.com/kKlMFRr_TLAyw99lIAkdqA8alCfGF3ZpvZEn6nYMm22NJm73WqVVAR6eOPy5QsLAktZ9vCH3uooIfEjUYzPg_90ymQtrj5B_E0-EtH8kSi6cIk1h-SmYDN8_43FHCS9LNEfgFIgUQrA=w16383"
    ],
    [
        "https://lh4.googleusercontent.com/SfPfnjViKh-aMeqnmFa62w0bCyNWEjuieLhKz3mMRKJmZmu-j0k0NzzoQIiMn2rFLmCIB9XIPNAjCQJTw0sAGJons-b-w2u67UAOyX4upsYo2YEwWWSaC4zUzevDQfaBF16mgBKKAHA=w16383",
        "https://lh6.googleusercontent.com/Yg-l8_rgm9PlTxVU7-oDRBb7Zvee8PJl0oSWqwqgH2P08wojD6iLtP1a6KfbqOQES0RpOyj6q0xuAmR3_kC1xcbnFnOhQ4fczeSxHU4WFzqRi3L8rIUWmj1Q8eO5Lopg_zavKvFwoEE=w16383",
        "https://lh6.googleusercontent.com/jX4ef5M_mn9s7QG8_Hj_3bdC4iBM2VyKGYsIhSszHSHerzgyWw4mojMb7KceHpSd8KkxzdeAdAXZnx0Pj0uvJSGQfcK1aa81I1T09rWULddIyz6RCgbyWgA64acfDQkMdwZ26nqVag=w16383"
    ],
    [
        "https://lh5.googleusercontent.com/zHqjw_6yWCuJKMubZcjUDepAYlTqcYZRQwOeMgeyhpW0Ln_HCCtXAauUwPkQmQj0D1ukz845__NgCUW3fuhjT-o2ibzAOO1GJTlbmPw67LrR99MOz6ebstzomjcZoEng7XP2z0RFun4=w16383",
        "https://lh3.googleusercontent.com/mEthEmhFIqqS5LdvQhX3UM64siqgZYv4zefG6KYa2bIvFgn2_UplSOPvf9dX_RYY1UL80czFEiSIdchG5FgPorbjfWVb-PCbQ-scCMHPVK03gFKbOzht2pbywbag0RVnbf1kgGlDjNw=w16383",
        "https://lh3.googleusercontent.com/H-sWOQjol21QZ2KOnBTOSofQjW03o7uEf501Yl5oITHWGpUuQBpm-fZGs4K1usdGOUwSOTl4UqvEAdMs04S-fkaN5ERjMCQSUgDp6cmVztf-LUJYx58aYGXYxoJEaG4eNvcHeqQV6lo=w16383",
        "https://lh5.googleusercontent.com/KAMh6oMB_Hb7LuOqBMrQvWsLQn2JcMYuFgEDAv0vZ4FT-9E4MOm73cTR9gitKN-t2vVONCsqkq8oLVmAMRv6rUon6oTOFOdAxZF1LgYqxr_H9Bfsu-IznikQKMz1pudz9-1REyRrjqw=w16383"
    ]
]

def download_image(url, file_path):
    """
    Downloads a single image from a URL to a specified path.
    Returns True on success, False on failure.
    """
    try:
        print(f"正在尝试下载 {url} 到 {file_path} ...")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        response = requests.get(url, stream=True, timeout=15, headers=headers)
        
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            print(f"下载成功: {file_path}")
            return True
        else:
            print(f"下载失败: 状态码 {response.status_code} - {url}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"下载时发生网络错误: {e} - {url}")
        return False
    except IOError as e:
        print(f"无法写入文件 {file_path}: {e}")
        return False

def process_images():
    """
    Attempts to download images. If an image already exists, it's skipped.
    If a download fails, the URL is saved to a 'failed_urls.txt' in the corresponding directory.
    """
    total_failed = 0
    for dir_index, url_list in enumerate(image_groups):
        dir_name = str(dir_index + 1)
        
        if not os.path.exists(dir_name):
            os.makedirs(dir_name)
            print(f"创建文件夹: {dir_name}")

        for img_index, url in enumerate(url_list):
            file_name = f"image_{img_index + 1}.jpg"
            file_path = os.path.join(dir_name, file_name)

            # Skip if file already exists and is not empty
            if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                print(f"文件已存在, 跳过: {file_path}")
                continue
            
            try:
                print(f"正在尝试下载 {url} ...")
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
                }
                response = requests.get(url, stream=True, timeout=15, headers=headers)
                
                if response.status_code == 200:
                    with open(file_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                    print(f"下载成功: {file_path}")
                else:
                    print(f"下载失败: 状态码 {response.status_code} - {url}")
                    failed_log_path = os.path.join(dir_name, 'failed_urls.txt')
                    with open(failed_log_path, 'a') as f:
                        f.write(url + '\n')
                    total_failed += 1


            except requests.exceptions.RequestException as e:
                print(f"下载时发生网络错误: {e} - {url}")
                failed_log_path = os.path.join(dir_name, 'failed_urls.txt')
                with open(failed_log_path, 'a') as f:
                    f.write(url + '\n')
                total_failed += 1

    print(f"\n处理完成。总共有 {total_failed} 个图片下载失败。失败的链接已保存到相应文件夹的 failed_urls.txt 文件中。")

if __name__ == "__main__":
    process_images()
