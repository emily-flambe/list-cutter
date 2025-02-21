from django.http import HttpResponse

def homepage(request):

    html = "<html><body><div>This is a Homepage</div></body></html>"
    return HttpResponse(html)
