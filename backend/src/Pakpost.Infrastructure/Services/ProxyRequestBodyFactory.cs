using System.Net.Http;
using System.Text;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Internal.Requests.Commands;

namespace Pakpost.Infrastructure.Services;

// Request body limits and per-mode serialization used by SafeHttpRequestRunner.
internal static class ProxyRequestBodyFactory
{
    internal static HttpContent? Create(SendHttpRequestCommand command,string mode,string raw)
    {
        switch(mode)
        {
            case "none":return null;
            case "urlencoded":
                return new FormUrlEncodedContent((command.FormFields??[]).Where(f=>!string.IsNullOrWhiteSpace(f.Key))
                    .Select(f=>new KeyValuePair<string,string>(f.Key,f.Value??"")));
            case "multipart":
            {
                var content=new MultipartFormDataContent();
                long total=0;
                foreach(var field in command.FormFields??[])
                {
                    if(string.IsNullOrWhiteSpace(field.Key))continue;
                    if(field.Key.Length>200)throw AppException.BadRequest("Form field name is too long");
                    if(field.Base64 is not null)
                    {
                        byte[] bytes;
                        try{bytes=Convert.FromBase64String(field.Base64);}
                        catch(FormatException){throw AppException.BadRequest("Invalid multipart file base64");}
                        total+=bytes.Length;
                        if(total>5_242_880)throw AppException.BadRequest("Multipart body exceeds 5 MB");
                        var file=new ByteArrayContent(bytes);
                        if(!string.IsNullOrWhiteSpace(field.ContentType))file.Headers.ContentType=System.Net.Http.Headers.MediaTypeHeaderValue.Parse(field.ContentType);
                        content.Add(file,field.Key,System.IO.Path.GetFileName(field.FileName??"upload.bin"));
                    }
                    else
                    {
                        total+=Encoding.UTF8.GetByteCount(field.Value??"");
                        if(total>5_242_880)throw AppException.BadRequest("Multipart body exceeds 5 MB");
                        content.Add(new StringContent(field.Value??"",Encoding.UTF8),field.Key);
                    }
                }
                return content;
            }
            case "binary":
            {
                byte[] bytes;
                try{bytes=Convert.FromBase64String(command.FileBase64??"");}
                catch(FormatException){throw AppException.BadRequest("Invalid binary base64");}
                if(bytes.Length>5_242_880)throw AppException.BadRequest("Binary body exceeds 5 MB");
                var file=new ByteArrayContent(bytes);
                file.Headers.ContentType=System.Net.Http.Headers.MediaTypeHeaderValue.Parse(command.ContentType??"application/octet-stream");
                return file;
            }
            default:
            {
                if(string.IsNullOrEmpty(raw))return null;
                var content=new ByteArrayContent(Encoding.UTF8.GetBytes(raw));
                if(!string.IsNullOrWhiteSpace(command.ContentType))
                    content.Headers.ContentType=System.Net.Http.Headers.MediaTypeHeaderValue.Parse(command.ContentType);
                return content;
            }
        }
    }
}
